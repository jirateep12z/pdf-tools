const RIGHT_ANGLE_DEGREES = 90;
const HALF_TURN_DEGREES = 180;
const THREE_QUARTER_TURN_DEGREES = 270;
const DEFAULT_WATERMARK_TEXT = 'CONFIDENTIAL';
const DEFAULT_WATERMARK_SIZE = 48;
const DEFAULT_WATERMARK_OPACITY = 0.3;
const DEFAULT_WATERMARK_ROTATION = -30;
const DEFAULT_WATERMARK_COLOR = '#737373';
const DEFAULT_PAGE_NUMBER_SIZE = 12;
const EDIT_MARGIN = 36;
const MAXIMUM_WATERMARK_OFFSET = 2000;
const DEFAULT_WATERMARK_PATTERN_GAP = 40;
const MAXIMUM_WATERMARK_PATTERN_GAP = 500;
const MAXIMUM_WATERMARK_PATTERN_ITEMS_PER_PAGE = 2000;
const MAXIMUM_COMPRESSION_CANVAS_PIXELS = 12000000;
const COMPRESSION_PRESETS = Object.freeze({
  low: Object.freeze({
    compression_level: 'low',
    dpi: null,
    jpeg_quality: null,
    maximum_canvas_pixels: MAXIMUM_COMPRESSION_CANVAS_PIXELS,
    should_rasterize: false
  }),
  medium: Object.freeze({
    compression_level: 'medium',
    dpi: 144,
    jpeg_quality: 0.75,
    maximum_canvas_pixels: MAXIMUM_COMPRESSION_CANVAS_PIXELS,
    should_rasterize: true
  }),
  high: Object.freeze({
    compression_level: 'high',
    dpi: 96,
    jpeg_quality: 0.55,
    maximum_canvas_pixels: MAXIMUM_COMPRESSION_CANVAS_PIXELS,
    should_rasterize: true
  })
});

class PdfOperationModule {
  constructor(render_module = new PdfRenderModule()) {
    this.render_module = render_module;
  }

  EnsurePdfLibAvailable() {
    if (typeof PDFLib === 'undefined') {
      throw new Error(
        'ไม่สามารถโหลด pdf-lib ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
  }

  ParsePageRange(range_text, page_count) {
    const cleaned_range_text = String(range_text || '').trim();
    if (!cleaned_range_text) {
      throw new Error('กรุณาระบุช่วงหน้า เช่น 1-3,5,8-10');
    }
    const page_indexes = [];
    const range_parts = cleaned_range_text.split(',');
    for (const range_part of range_parts) {
      const trimmed_part = range_part.trim();
      if (/^\d+$/.test(trimmed_part)) {
        const page_number = Number(trimmed_part);
        this.ValidatePageNumber(page_number, page_count);
        page_indexes.push(page_number - 1);
        continue;
      }
      if (/^\d+-\d+$/.test(trimmed_part)) {
        const [start_page, end_page] = trimmed_part.split('-').map(Number);
        this.ValidatePageNumber(start_page, page_count);
        this.ValidatePageNumber(end_page, page_count);
        if (start_page > end_page) {
          throw new Error('ช่วงหน้าต้องเรียงจากน้อยไปมาก');
        }
        for (
          let page_number = start_page;
          page_number <= end_page;
          page_number += 1
        ) {
          page_indexes.push(page_number - 1);
        }
        continue;
      }
      throw new Error('รูปแบบช่วงหน้าไม่ถูกต้อง กรุณาใช้รูปแบบ 1-3,5,8-10');
    }
    return Array.from(new Set(page_indexes));
  }

  ParseOptionalPageRange(range_text, page_count) {
    const cleaned_range_text = String(range_text || '').trim();
    if (!cleaned_range_text) {
      return Array.from({ length: page_count }, (_, page_index) => page_index);
    }
    return this.ParsePageRange(cleaned_range_text, page_count);
  }

  FormatPageRange(page_indexes) {
    const sorted_page_indexes = Array.from(new Set(page_indexes))
      .filter(page_index => Number.isInteger(page_index) && page_index >= 0)
      .sort((first_index, second_index) => first_index - second_index);
    const range_parts = [];
    let run_start_index = null;
    let run_end_index = null;
    for (const page_index of sorted_page_indexes) {
      if (run_end_index !== null && page_index === run_end_index + 1) {
        run_end_index = page_index;
        continue;
      }
      if (run_start_index !== null) {
        range_parts.push(this.FormatPageRun(run_start_index, run_end_index));
      }
      run_start_index = page_index;
      run_end_index = page_index;
    }
    if (run_start_index !== null) {
      range_parts.push(this.FormatPageRun(run_start_index, run_end_index));
    }
    return range_parts.join(',');
  }

  FormatPageRun(start_index, end_index) {
    if (start_index === end_index) {
      return `${start_index + 1}`;
    }
    return `${start_index + 1}-${end_index + 1}`;
  }

  ValidatePageNumber(page_number, page_count) {
    if (
      !Number.isInteger(page_number) ||
      page_number < 1 ||
      page_number > page_count
    ) {
      throw new Error(`เลขหน้าต้องอยู่ระหว่าง 1-${page_count}`);
    }
  }

  async LoadPdfDocument(uploaded_file) {
    this.EnsurePdfLibAvailable();
    try {
      return await PDFLib.PDFDocument.load(uploaded_file.file_bytes);
    } catch (error) {
      throw new Error('ไม่สามารถอ่านไฟล์นี้ได้');
    }
  }

  async MergePdfFiles(uploaded_files) {
    this.EnsurePdfLibAvailable();
    if (!uploaded_files || uploaded_files.length === 0) {
      throw new Error('กรุณาอัปโหลดไฟล์ก่อน');
    }
    const output_document = await PDFLib.PDFDocument.create();
    for (const uploaded_file of uploaded_files) {
      const source_document = await this.LoadPdfDocument(uploaded_file);
      const page_indexes = source_document.getPageIndices();
      const copied_pages = await output_document.copyPages(
        source_document,
        page_indexes
      );
      copied_pages.forEach(page => output_document.addPage(page));
    }
    if (output_document.getPageCount() === 0) {
      throw new Error('ไม่มีหน้าสำหรับสร้างไฟล์');
    }
    return output_document.save();
  }

  async SplitPdfFile(uploaded_file, range_text) {
    this.EnsurePdfLibAvailable();
    const source_document = await this.LoadPdfDocument(uploaded_file);
    const page_indexes = this.ParsePageRange(
      range_text,
      source_document.getPageCount()
    );
    const output_document = await PDFLib.PDFDocument.create();
    const copied_pages = await output_document.copyPages(
      source_document,
      page_indexes
    );
    copied_pages.forEach(page => output_document.addPage(page));
    if (output_document.getPageCount() === 0) {
      throw new Error('ไม่มีหน้าสำหรับสร้างไฟล์');
    }
    return output_document.save();
  }

  async CreatePageOperations(uploaded_files) {
    this.EnsurePdfLibAvailable();
    const page_operations = [];
    for (const uploaded_file of uploaded_files) {
      const source_document = await this.LoadPdfDocument(uploaded_file);
      const page_count = source_document.getPageCount();
      for (let page_index = 0; page_index < page_count; page_index += 1) {
        page_operations.push({
          operation_id: `${uploaded_file.file_name}-${page_index}-${Date.now()}`,
          file_name: uploaded_file.file_name,
          file_bytes: uploaded_file.file_bytes,
          source_page_index: page_index,
          display_page_number: page_index + 1,
          file_page_count: page_count,
          rotation_degrees: 0,
          is_deleted: false
        });
      }
    }
    return page_operations;
  }

  async ExportPageOperations(page_operations) {
    this.EnsurePdfLibAvailable();
    const active_operations = (page_operations || []).filter(page_operation => {
      return !page_operation.is_deleted;
    });
    if (active_operations.length === 0) {
      throw new Error('ไม่มีหน้าสำหรับสร้างไฟล์');
    }
    const output_document = await PDFLib.PDFDocument.create();
    for (const page_operation of active_operations) {
      const source_document = await PDFLib.PDFDocument.load(
        page_operation.file_bytes
      );
      const [copied_page] = await output_document.copyPages(source_document, [
        page_operation.source_page_index
      ]);
      const rotation_degrees = this.NormalizeRotation(
        page_operation.rotation_degrees
      );
      copied_page.setRotation(PDFLib.degrees(rotation_degrees));
      output_document.addPage(copied_page);
    }
    return output_document.save();
  }

  NormalizeRotation(rotation_degrees) {
    const normalized_rotation = ((rotation_degrees % 360) + 360) % 360;
    if (
      normalized_rotation === RIGHT_ANGLE_DEGREES ||
      normalized_rotation === HALF_TURN_DEGREES ||
      normalized_rotation === THREE_QUARTER_TURN_DEGREES
    ) {
      return normalized_rotation;
    }
    return 0;
  }

  async CreatePdfFromImages(uploaded_files) {
    this.EnsurePdfLibAvailable();
    if (!uploaded_files || uploaded_files.length === 0) {
      throw new Error('กรุณาอัปโหลดไฟล์ก่อน');
    }
    const output_document = await PDFLib.PDFDocument.create();
    for (const uploaded_file of uploaded_files) {
      const image_bytes =
        await this.CreatePdfCompatibleImageBytes(uploaded_file);
      const embedded_image =
        uploaded_file.file_type === 'image/png' ||
        uploaded_file.file_type === 'image/webp'
          ? await output_document.embedPng(image_bytes)
          : await output_document.embedJpg(image_bytes);
      const image_width = embedded_image.width;
      const image_height = embedded_image.height;
      const page = output_document.addPage([image_width, image_height]);
      page.drawImage(embedded_image, {
        x: 0,
        y: 0,
        width: image_width,
        height: image_height
      });
    }
    return output_document.save();
  }

  NormalizeCompressionOptions(compression_options = {}) {
    const compression_level = compression_options.compression_level || 'medium';
    const compression_preset = COMPRESSION_PRESETS[compression_level];
    if (!compression_preset) {
      throw new Error('ระดับการบีบอัดไม่ถูกต้อง กรุณาเลือกระดับใหม่');
    }
    return { ...compression_preset };
  }

  async CompressPdfFile(
    uploaded_file,
    compression_options = {},
    OnProgress = () => {}
  ) {
    this.EnsurePdfLibAvailable();
    if (!uploaded_file) {
      throw new Error('กรุณาอัปโหลดไฟล์ก่อน');
    }
    const normalized_options =
      this.NormalizeCompressionOptions(compression_options);
    let compressed_bytes;
    try {
      compressed_bytes = normalized_options.should_rasterize
        ? await this.CompressPdfAsImages(
            uploaded_file,
            normalized_options,
            OnProgress
          )
        : await this.CompressPdfStructure(uploaded_file);
    } catch (error) {
      throw this.CreateCompressionError(error);
    }
    return this.BuildCompressionResult(
      uploaded_file.file_bytes,
      compressed_bytes,
      normalized_options.compression_level
    );
  }

  async CompressPdfStructure(uploaded_file) {
    const source_document = await this.LoadPdfDocument(uploaded_file);
    return source_document.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
  }

  async CompressPdfAsImages(uploaded_file, compression_options, OnProgress) {
    const source_document =
      await this.render_module.LoadPdfDocument(uploaded_file);
    try {
      const output_document = await PDFLib.PDFDocument.create();
      for (
        let page_number = 1;
        page_number <= source_document.numPages;
        page_number += 1
      ) {
        const rendered_page = await this.render_module.RenderPageAsJpeg(
          source_document,
          page_number,
          compression_options
        );
        const embedded_image = await output_document.embedJpg(
          rendered_page.image_bytes
        );
        const output_page = output_document.addPage([
          rendered_page.page_width_points,
          rendered_page.page_height_points
        ]);
        output_page.drawImage(embedded_image, {
          x: 0,
          y: 0,
          width: rendered_page.page_width_points,
          height: rendered_page.page_height_points
        });
        OnProgress({
          current_page: page_number,
          page_count: source_document.numPages
        });
      }
      return output_document.save({
        useObjectStreams: true,
        addDefaultPage: false
      });
    } finally {
      try {
        await source_document.cleanup();
      } finally {
        await source_document.loadingTask.destroy();
      }
    }
  }

  BuildCompressionResult(original_bytes, candidate_bytes, compression_level) {
    const original_size_bytes = original_bytes.byteLength;
    const candidate_size_bytes = candidate_bytes.byteLength;
    const used_original_file = candidate_size_bytes >= original_size_bytes;
    const file_bytes = used_original_file ? original_bytes : candidate_bytes;
    const compressed_size_bytes = file_bytes.byteLength;
    const reduction_percent =
      original_size_bytes > 0
        ? ((original_size_bytes - compressed_size_bytes) /
            original_size_bytes) *
          100
        : 0;
    return {
      file_bytes: file_bytes,
      original_size_bytes: original_size_bytes,
      compressed_size_bytes: compressed_size_bytes,
      reduction_percent: reduction_percent,
      compression_level: compression_level,
      used_original_file: used_original_file
    };
  }

  CreateCompressionError(error) {
    const error_message = String(error?.message || '');
    const user_facing_prefixes = [
      'ไฟล์ PDF มีรหัสผ่าน',
      'ไม่สามารถอ่านไฟล์ PDF',
      'ไม่สามารถสร้างภาพจากหน้า PDF'
    ];
    const is_user_facing = user_facing_prefixes.some(error_prefix => {
      return error_message.startsWith(error_prefix);
    });
    if (is_user_facing) {
      return new Error(error_message);
    }
    return new Error(
      'ไม่สามารถบีบอัด PDF ได้ กรุณาลองระดับต่ำ หรือปิดแท็บอื่นเพื่อเพิ่มหน่วยความจำแล้วลองอีกครั้ง'
    );
  }

  async AddWatermarkToPdf(uploaded_file, watermark_options) {
    this.EnsurePdfLibAvailable();
    if (!uploaded_file) {
      throw new Error('กรุณาอัปโหลดไฟล์ก่อน');
    }
    const options = this.NormalizeWatermarkOptions(watermark_options);
    const pdf_document = await this.LoadPdfDocument(uploaded_file);
    const font = await pdf_document.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdf_document.getPages();
    const selected_page_indexes = new Set(
      this.ParseOptionalPageRange(options.page_range, pages.length)
    );
    pages.forEach((page, page_index) => {
      if (!selected_page_indexes.has(page_index)) {
        return;
      }
      const page_size = page.getSize();
      if (options.is_pattern_enabled) {
        this.DrawWatermarkPattern(page, font, options, page_size);
      } else {
        this.DrawSingleWatermark(page, font, options, page_size);
      }
    });
    return pdf_document.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
  }

  async AddPageNumbersToPdf(uploaded_file, page_number_options) {
    this.EnsurePdfLibAvailable();
    if (!uploaded_file) {
      throw new Error('กรุณาอัปโหลดไฟล์ก่อน');
    }
    const options = this.NormalizePageNumberOptions(page_number_options);
    const pdf_document = await this.LoadPdfDocument(uploaded_file);
    const font = await pdf_document.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdf_document.getPages();
    const selected_page_indexes = this.ParseOptionalPageRange(
      options.page_range,
      pages.length
    );
    const selected_page_set = new Set(selected_page_indexes);
    const selected_total = selected_page_indexes.length;
    let rendered_page_count = 0;
    pages.forEach((page, page_index) => {
      if (!selected_page_set.has(page_index)) {
        return;
      }
      const page_number = options.start_number + rendered_page_count;
      rendered_page_count += 1;
      const page_size = page.getSize();
      const text = this.FormatPageNumberText(
        page_number,
        selected_total,
        options.format
      );
      const text_width = font.widthOfTextAtSize(text, options.size);
      const position = this.CalculatePageNumberPosition(
        options.position,
        page_size,
        text_width,
        options.size
      );
      page.drawText(text, {
        x: position.x,
        y: position.y,
        size: options.size,
        font: font,
        color: PDFLib.rgb(0.25, 0.25, 0.25)
      });
    });
    return pdf_document.save({
      useObjectStreams: true,
      addDefaultPage: false
    });
  }

  NormalizeWatermarkOptions(watermark_options = {}) {
    const text = String(
      watermark_options.text || DEFAULT_WATERMARK_TEXT
    ).trim();
    if (!text) {
      throw new Error('กรุณาใส่ข้อความลายน้ำ');
    }
    const size = this.ClampNumber(
      Number(watermark_options.size),
      8,
      96,
      DEFAULT_WATERMARK_SIZE
    );
    const opacity_percent = this.ClampNumber(
      Number(watermark_options.opacity_percent),
      5,
      100,
      DEFAULT_WATERMARK_OPACITY * 100
    );
    const rotation_degrees = this.ClampNumber(
      Number(watermark_options.rotation_degrees),
      -180,
      180,
      DEFAULT_WATERMARK_ROTATION
    );
    return {
      text: text,
      size: size,
      opacity: opacity_percent / 100,
      rotation_degrees: rotation_degrees,
      position: watermark_options.position || 'center',
      offset_x: this.ClampNumber(
        this.ParseOptionalNumber(watermark_options.offset_x),
        -MAXIMUM_WATERMARK_OFFSET,
        MAXIMUM_WATERMARK_OFFSET,
        0
      ),
      offset_y: this.ClampNumber(
        this.ParseOptionalNumber(watermark_options.offset_y),
        -MAXIMUM_WATERMARK_OFFSET,
        MAXIMUM_WATERMARK_OFFSET,
        0
      ),
      color: this.ParseHexColor(
        watermark_options.color || DEFAULT_WATERMARK_COLOR
      ),
      is_pattern_enabled: Boolean(watermark_options.is_pattern_enabled),
      gap_x: this.ClampNumber(
        this.ParseOptionalNumber(watermark_options.gap_x),
        0,
        MAXIMUM_WATERMARK_PATTERN_GAP,
        DEFAULT_WATERMARK_PATTERN_GAP
      ),
      gap_y: this.ClampNumber(
        this.ParseOptionalNumber(watermark_options.gap_y),
        0,
        MAXIMUM_WATERMARK_PATTERN_GAP,
        DEFAULT_WATERMARK_PATTERN_GAP
      ),
      page_range: watermark_options.page_range || ''
    };
  }

  NormalizePageNumberOptions(page_number_options = {}) {
    const start_number = this.ClampNumber(
      Number(page_number_options.start_number),
      1,
      9999,
      1
    );
    return {
      format: ['page_label', 'page_label_total'].includes(
        page_number_options.format
      )
        ? page_number_options.format
        : 'number',
      position: page_number_options.position || 'bottom-center',
      size: DEFAULT_PAGE_NUMBER_SIZE,
      start_number: start_number,
      page_range: page_number_options.page_range || ''
    };
  }

  DrawSingleWatermark(page, font, options, page_size) {
    const text_layout = this.CalculateWatermarkTextLayout(font, options);
    const preset_center = this.CalculateWatermarkCenter(
      options.position,
      page_size,
      text_layout
    );
    this.DrawWatermarkText(page, font, options, text_layout, {
      x: preset_center.x + options.offset_x,
      y: preset_center.y + options.offset_y
    });
  }

  DrawWatermarkPattern(page, font, options, page_size) {
    const text_layout = this.CalculateWatermarkTextLayout(font, options);
    const text_centers = this.CalculateWatermarkPatternCenters(
      options,
      page_size,
      text_layout
    );
    text_centers.forEach(text_center => {
      this.DrawWatermarkText(page, font, options, text_layout, text_center);
    });
  }

  // Lays the grid out along the rotated text axes so that neighbours are
  // always one text size plus the gap apart, whatever the rotation.
  CalculateWatermarkPatternCenters(options, page_size, text_layout) {
    const along_step = text_layout.text_width + options.gap_x;
    const across_step = text_layout.text_height + options.gap_y;
    const anchor_x = page_size.width / 2 + options.offset_x;
    const anchor_y = page_size.height / 2 + options.offset_y;
    const projected_corners = [
      [0, 0],
      [page_size.width, 0],
      [0, page_size.height],
      [page_size.width, page_size.height]
    ].map(([corner_x, corner_y]) => {
      const relative_x = corner_x - anchor_x;
      const relative_y = corner_y - anchor_y;
      return {
        along: relative_x * text_layout.cosine + relative_y * text_layout.sine,
        across: -relative_x * text_layout.sine + relative_y * text_layout.cosine
      };
    });
    const projected_alongs = projected_corners.map(corner => corner.along);
    const projected_acrosses = projected_corners.map(corner => corner.across);
    const first_along_index = Math.floor(
      Math.min(...projected_alongs) / along_step
    );
    const last_along_index = Math.ceil(
      Math.max(...projected_alongs) / along_step
    );
    const first_across_index = Math.floor(
      Math.min(...projected_acrosses) / across_step
    );
    const last_across_index = Math.ceil(
      Math.max(...projected_acrosses) / across_step
    );
    const candidate_count =
      (last_along_index - first_along_index + 1) *
      (last_across_index - first_across_index + 1);
    if (candidate_count > MAXIMUM_WATERMARK_PATTERN_ITEMS_PER_PAGE) {
      throw new Error(
        'ลายน้ำแบบ pattern มีจำนวนมากเกินไป กรุณาเพิ่มระยะห่างหรือขนาดตัวอักษรแล้วลองอีกครั้ง'
      );
    }
    const text_centers = [];
    for (
      let across_index = first_across_index;
      across_index <= last_across_index;
      across_index += 1
    ) {
      for (
        let along_index = first_along_index;
        along_index <= last_along_index;
        along_index += 1
      ) {
        const along_distance = along_index * along_step;
        const across_distance = across_index * across_step;
        const text_center = {
          x:
            anchor_x +
            along_distance * text_layout.cosine -
            across_distance * text_layout.sine,
          y:
            anchor_y +
            along_distance * text_layout.sine +
            across_distance * text_layout.cosine
        };
        if (this.IsWatermarkOnPage(text_center, page_size, text_layout)) {
          text_centers.push(text_center);
        }
      }
    }
    return text_centers;
  }

  IsWatermarkOnPage(text_center, page_size, text_layout) {
    return (
      text_center.x + text_layout.half_footprint_width >= 0 &&
      text_center.x - text_layout.half_footprint_width <= page_size.width &&
      text_center.y + text_layout.half_footprint_height >= 0 &&
      text_center.y - text_layout.half_footprint_height <= page_size.height
    );
  }

  CalculateWatermarkTextLayout(font, options) {
    const text_width = font.widthOfTextAtSize(options.text, options.size);
    const text_height = options.size;
    const rotation_radians = (options.rotation_degrees * Math.PI) / 180;
    const cosine = Math.cos(rotation_radians);
    const sine = Math.sin(rotation_radians);
    return {
      text_width: text_width,
      text_height: text_height,
      cosine: cosine,
      sine: sine,
      half_footprint_width:
        (Math.abs(text_width * cosine) + Math.abs(text_height * sine)) / 2,
      half_footprint_height:
        (Math.abs(text_width * sine) + Math.abs(text_height * cosine)) / 2
    };
  }

  // pdf-lib rotates text around its bottom-left origin, so the origin is
  // offset from the desired center by the rotated half-size vector.
  DrawWatermarkText(page, font, options, text_layout, text_center) {
    const half_width = text_layout.text_width / 2;
    const half_height = text_layout.text_height / 2;
    page.drawText(options.text, {
      x:
        text_center.x -
        (half_width * text_layout.cosine - half_height * text_layout.sine),
      y:
        text_center.y -
        (half_width * text_layout.sine + half_height * text_layout.cosine),
      size: options.size,
      font: font,
      color: options.color,
      opacity: options.opacity,
      rotate: PDFLib.degrees(options.rotation_degrees)
    });
  }

  FormatPageNumberText(page_number, selected_total, format) {
    if (format === 'page_label_total') {
      return `Page ${page_number} of ${selected_total}`;
    }
    if (format === 'page_label') {
      return `Page ${page_number}`;
    }
    return `${page_number}`;
  }

  CalculateWatermarkCenter(position, page_size, text_layout) {
    const left_x = EDIT_MARGIN + text_layout.half_footprint_width;
    const right_x =
      page_size.width - EDIT_MARGIN - text_layout.half_footprint_width;
    const top_y =
      page_size.height - EDIT_MARGIN - text_layout.half_footprint_height;
    const bottom_y = EDIT_MARGIN + text_layout.half_footprint_height;
    const position_map = {
      center: { x: page_size.width / 2, y: page_size.height / 2 },
      'top-left': { x: left_x, y: top_y },
      'top-right': { x: right_x, y: top_y },
      'bottom-left': { x: left_x, y: bottom_y },
      'bottom-right': { x: right_x, y: bottom_y }
    };
    return position_map[position] || position_map.center;
  }

  CalculatePageNumberPosition(position, page_size, text_width, text_height) {
    const vertical_map = {
      top: page_size.height - EDIT_MARGIN - text_height,
      bottom: EDIT_MARGIN
    };
    const horizontal_map = {
      left: EDIT_MARGIN,
      center: (page_size.width - text_width) / 2,
      right: page_size.width - EDIT_MARGIN - text_width
    };
    const [vertical_side, horizontal_side] = String(position).split('-');
    const is_known_position =
      Object.hasOwn(vertical_map, vertical_side) &&
      Object.hasOwn(horizontal_map, horizontal_side);
    return {
      x: horizontal_map[is_known_position ? horizontal_side : 'center'],
      y: vertical_map[is_known_position ? vertical_side : 'bottom']
    };
  }

  ParseOptionalNumber(raw_value) {
    if (raw_value === undefined || raw_value === null) {
      return Number.NaN;
    }
    const trimmed_value = String(raw_value).trim();
    return trimmed_value === '' ? Number.NaN : Number(trimmed_value);
  }

  ClampNumber(raw_value, min_value, max_value, default_value) {
    if (!Number.isFinite(raw_value)) {
      return default_value;
    }
    return Math.min(Math.max(raw_value, min_value), max_value);
  }

  ParseHexColor(hex_color) {
    const normalized_color = String(hex_color || DEFAULT_WATERMARK_COLOR)
      .trim()
      .replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized_color)) {
      return this.ParseHexColor(DEFAULT_WATERMARK_COLOR);
    }
    const red = parseInt(normalized_color.slice(0, 2), 16) / 255;
    const green = parseInt(normalized_color.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized_color.slice(4, 6), 16) / 255;
    return PDFLib.rgb(red, green, blue);
  }

  async CreatePdfCompatibleImageBytes(uploaded_file) {
    if (uploaded_file.file_type !== 'image/webp') {
      return uploaded_file.file_bytes;
    }
    const image_blob = new Blob([uploaded_file.file_bytes], {
      type: uploaded_file.file_type
    });
    const image_bitmap = await createImageBitmap(image_blob);
    const canvas = document.createElement('canvas');
    canvas.width = image_bitmap.width;
    canvas.height = image_bitmap.height;
    const canvas_context = canvas.getContext('2d');
    if (!canvas_context) {
      throw new Error('ไม่สามารถแปลงรูปภาพ WebP ได้');
    }
    canvas_context.drawImage(image_bitmap, 0, 0);
    const png_blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!png_blob) {
      throw new Error('ไม่สามารถแปลงรูปภาพ WebP ได้');
    }
    return png_blob.arrayBuffer();
  }
}
