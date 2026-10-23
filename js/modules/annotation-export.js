const ANNOTATION_LINE_HEIGHT_RATIO = 1.2;
const ANNOTATION_DEFAULT_FONT_SIZE = 0.03;
const ANNOTATION_DEFAULT_STROKE_WIDTH = 0.003;
const ANNOTATION_EXPORT_LINE_COUNT_EPSILON = 1e-6;

class AnnotationExport {
  constructor() {
    this.warnings = [];
  }

  EnsureDependencies() {
    if (typeof PDFLib === 'undefined') {
      throw new Error(
        'ไม่สามารถโหลด pdf-lib ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
    if (typeof fontkit === 'undefined') {
      throw new Error(
        'ไม่สามารถโหลด fontkit ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
  }

  HasAnnotations(annotations_by_page) {
    return Object.keys(annotations_by_page || {}).some(
      key => (annotations_by_page[key] || []).length > 0
    );
  }

  ParseHexColor(hex_color) {
    const normalized = String(hex_color || '#000000')
      .trim()
      .replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return PDFLib.rgb(0, 0, 0);
    }
    return PDFLib.rgb(
      parseInt(normalized.slice(0, 2), 16) / 255,
      parseInt(normalized.slice(2, 4), 16) / 255,
      parseInt(normalized.slice(4, 6), 16) / 255
    );
  }

  DataUrlToBytes(data_url) {
    const base64 = String(data_url || '').split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  Opacity(element) {
    return element.opacity != null ? element.opacity : 1;
  }

  AddWarning(warning_message) {
    if (!this.warnings.includes(warning_message)) {
      this.warnings.push(warning_message);
    }
  }

  GetWarnings() {
    return [...this.warnings];
  }

  MeasureTextWidth(font, text, font_size) {
    return font.widthOfTextAtSize(String(text || ''), font_size);
  }

  WrapTextLines(text, font, font_size, max_width) {
    const safe_width = Math.max(Number(max_width) || 0, font_size);
    const wrapped_lines = [];
    String(text || '')
      .split('\n')
      .forEach(paragraph => {
        let current_line = '';
        Array.from(paragraph).forEach(character => {
          const candidate_line = `${current_line}${character}`;
          const candidate_width = this.MeasureTextWidth(
            font,
            candidate_line,
            font_size
          );
          if (current_line && candidate_width > safe_width) {
            wrapped_lines.push(current_line);
            current_line = character;
            return;
          }
          current_line = candidate_line;
        });
        wrapped_lines.push(current_line);
      });
    return wrapped_lines;
  }

  LimitTextLines(lines, max_height, line_height) {
    const max_line_count = Math.max(
      1,
      Math.floor(
        (Number(max_height) || line_height) / line_height +
          ANNOTATION_EXPORT_LINE_COUNT_EPSILON
      )
    );
    return lines.slice(0, max_line_count);
  }

  AlignmentOffset(align, max_width, line_width) {
    if (align === 'center') {
      return Math.max((max_width - line_width) / 2, 0);
    }
    if (align === 'right') {
      return Math.max(max_width - line_width, 0);
    }
    return 0;
  }

  ResolveFontOption(font_key) {
    return AnnotationFonts.Resolve(font_key);
  }

  async LoadFontBytes(font_option) {
    const response = await fetch(font_option.url);
    if (!response.ok) {
      throw new Error('ไม่สามารถโหลดฟอนต์ภาษาไทยได้');
    }
    return response.arrayBuffer();
  }

  async EmbedTextFont(pdf_document, font_cache, element) {
    const font_option = this.ResolveFontOption(element.font_key);
    if (font_cache[font_option.key]) {
      return font_cache[font_option.key];
    }
    const font_bytes = await this.LoadFontBytes(font_option);
    const embedded_font = await pdf_document.embedFont(font_bytes, {
      subset: false
    });
    font_cache[font_option.key] = embedded_font;
    return embedded_font;
  }

  async Apply(file_bytes, annotations_by_page) {
    this.warnings = [];
    this.EnsureDependencies();
    if (!this.HasAnnotations(annotations_by_page)) {
      throw new Error('ยังไม่มีองค์ประกอบให้บันทึก');
    }
    const pdf_document = await PDFLib.PDFDocument.load(file_bytes);
    pdf_document.registerFontkit(fontkit);
    const font_cache = {};
    const pages = pdf_document.getPages();
    for (const page_key of Object.keys(annotations_by_page)) {
      const page_index = Number(page_key);
      const page = pages[page_index];
      if (!page) continue;
      const elements = annotations_by_page[page_key] || [];
      for (const element of elements) {
        await this.DrawElement(pdf_document, page, font_cache, element);
      }
    }
    return pdf_document.save({ useObjectStreams: true, addDefaultPage: false });
  }

  PageContext(page) {
    const size = page.getSize();
    const rotation = page.getRotation().angle;
    const visible = AnnotationGeometry.VisibleSize(
      size.width,
      size.height,
      rotation
    );
    return { size, rotation, visible };
  }

  RectToUser(element, context) {
    const rect = AnnotationGeometry.RelToVisibleRect(
      element,
      context.visible.width,
      context.visible.height
    );
    const center = AnnotationGeometry.VisiblePointToUser(
      rect.center_u,
      rect.center_v,
      context.size.width,
      context.size.height,
      context.rotation
    );
    const user_size = AnnotationGeometry.UserSize(
      rect.width,
      rect.height,
      context.rotation
    );
    const angle = AnnotationGeometry.UserDrawAngle(
      element.rotation || 0,
      context.rotation
    );
    const corner = AnnotationGeometry.CenterToCorner(
      center.x,
      center.y,
      user_size.width,
      user_size.height,
      angle
    );
    return { corner, user_size, angle };
  }

  async DrawElement(pdf_document, page, font_cache, element) {
    const context = this.PageContext(page);
    try {
      if (element.type === 'block') {
        this.DrawBlock(page, element, context);
      } else if (element.type === 'text') {
        const text_font = await this.EmbedTextFont(
          pdf_document,
          font_cache,
          element
        );
        this.DrawText(page, text_font, element, context);
      } else if (element.type === 'image') {
        await this.DrawImage(pdf_document, page, element, context);
      } else if (element.type === 'line') {
        this.DrawLine(page, element, context);
      }
    } catch (error) {
      if (element.type !== 'image') {
        throw error;
      }
      this.AddWarning('ข้ามรูปภาพบางรายการเพราะไม่สามารถฝังลง PDF ได้');
    }
  }

  DrawBlock(page, element, context) {
    const geometry = this.RectToUser(element, context);
    page.drawRectangle({
      x: geometry.corner.x,
      y: geometry.corner.y,
      width: geometry.user_size.width,
      height: geometry.user_size.height,
      color: this.ParseHexColor(element.fill_color),
      opacity: this.Opacity(element),
      rotate: PDFLib.degrees(geometry.angle)
    });
  }

  DrawText(page, thai_font, element, context) {
    const geometry = this.RectToUser(element, context);
    const font_size =
      (element.font_size || ANNOTATION_DEFAULT_FONT_SIZE) *
      context.visible.height;
    const line_height = font_size * ANNOTATION_LINE_HEIGHT_RATIO;
    const max_width = Math.max(
      element.width * context.visible.width,
      font_size
    );
    const max_height = Math.max(
      element.height * context.visible.height,
      line_height
    );
    const center_u = element.x * context.visible.width + max_width / 2;
    const center_v =
      element.y * context.visible.height +
      (element.height * context.visible.height) / 2;
    const layout_lines = element.is_auto_width
      ? String(element.text || '').split('\n')
      : this.WrapTextLines(element.text, thai_font, font_size, max_width);
    const lines = this.LimitTextLines(layout_lines, max_height, line_height);
    lines.forEach((line, line_index) => {
      const line_width = this.MeasureTextWidth(thai_font, line, font_size);
      const align_offset = this.AlignmentOffset(
        element.align,
        max_width,
        line_width
      );
      const visible_origin = this.RotateVisiblePoint(
        element.x * context.visible.width + align_offset,
        element.y * context.visible.height +
          font_size +
          line_index * line_height,
        center_u,
        center_v,
        element.rotation || 0
      );
      const origin = AnnotationGeometry.VisiblePointToUser(
        visible_origin.u,
        visible_origin.v,
        context.size.width,
        context.size.height,
        context.rotation
      );
      page.drawText(line, {
        x: origin.x,
        y: origin.y,
        size: font_size,
        font: thai_font,
        color: this.ParseHexColor(element.color),
        opacity: this.Opacity(element),
        rotate: PDFLib.degrees(geometry.angle)
      });
    });
  }

  async DrawImage(pdf_document, page, element, context) {
    const geometry = this.RectToUser(element, context);
    const bytes = this.DataUrlToBytes(element.image_data_url);
    const is_png = String(element.image_data_url || '').startsWith(
      'data:image/png'
    );
    const image = is_png
      ? await pdf_document.embedPng(bytes)
      : await pdf_document.embedJpg(bytes);
    page.drawImage(image, {
      x: geometry.corner.x,
      y: geometry.corner.y,
      width: geometry.user_size.width,
      height: geometry.user_size.height,
      opacity: this.Opacity(element),
      rotate: PDFLib.degrees(geometry.angle)
    });
  }

  RotateVisiblePoint(u, v, center_u, center_v, degrees) {
    const angle = (degrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const du = u - center_u;
    const dv = v - center_v;
    return {
      u: center_u + du * cos - dv * sin,
      v: center_v + du * sin + dv * cos
    };
  }

  DrawLine(page, element, context) {
    const start_u = element.x * context.visible.width;
    const start_v = element.y * context.visible.height;
    const end_u = (element.x + element.width) * context.visible.width;
    const end_v = (element.y + element.height) * context.visible.height;
    const center_u = (start_u + end_u) / 2;
    const center_v = (start_v + end_v) / 2;
    const rotation = element.rotation || 0;
    const start_rotated = this.RotateVisiblePoint(
      start_u,
      start_v,
      center_u,
      center_v,
      rotation
    );
    const end_rotated = this.RotateVisiblePoint(
      end_u,
      end_v,
      center_u,
      center_v,
      rotation
    );
    const start = AnnotationGeometry.VisiblePointToUser(
      start_rotated.u,
      start_rotated.v,
      context.size.width,
      context.size.height,
      context.rotation
    );
    const end = AnnotationGeometry.VisiblePointToUser(
      end_rotated.u,
      end_rotated.v,
      context.size.width,
      context.size.height,
      context.rotation
    );
    const color = this.ParseHexColor(element.stroke_color);
    const thickness =
      (element.stroke_width || ANNOTATION_DEFAULT_STROKE_WIDTH) *
      context.visible.height;
    const opacity = this.Opacity(element);
    page.drawLine({ start, end, thickness, color, opacity });
    if (element.has_arrow) {
      this.DrawArrowHead(page, start, end, thickness, color, opacity);
    }
  }

  DrawArrowHead(page, start, end, thickness, color, opacity) {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const head_length = thickness * 4 + 6;
    const spread = Math.PI / 7;
    const left = {
      x: end.x - head_length * Math.cos(angle - spread),
      y: end.y - head_length * Math.sin(angle - spread)
    };
    const right = {
      x: end.x - head_length * Math.cos(angle + spread),
      y: end.y - head_length * Math.sin(angle + spread)
    };
    page.drawLine({ start: end, end: left, thickness, color, opacity });
    page.drawLine({ start: end, end: right, thickness, color, opacity });
  }
}
