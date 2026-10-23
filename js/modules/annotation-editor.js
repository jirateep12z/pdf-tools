const ANNOTATION_SVG_NS = 'http://www.w3.org/2000/svg';
const ANNOTATION_EDITOR_LINE_HEIGHT_RATIO = 1.2;
const ANNOTATION_DEFAULT_TEXT_FONT_KEY = AnnotationFonts.DefaultKey();
const ANNOTATION_DEFAULTS = {
  text: {
    width: 0.4,
    height: 0.08,
    text: '',
    is_auto_width: true,
    font_size: 0.03,
    font_key: ANNOTATION_DEFAULT_TEXT_FONT_KEY,
    color: '#000000',
    align: 'left',
    opacity: 1
  },
  block: { width: 0.3, height: 0.15, fill_color: '#3366ff', opacity: 0.4 },
  image: { width: 0.3, height: 0.2, opacity: 1 },
  line: {
    width: 0.3,
    height: 0,
    stroke_color: '#ff0000',
    stroke_width: 0.004,
    has_arrow: true,
    opacity: 1
  }
};
const ANNOTATION_SELECTION_COLOR = '#15803d';
const ANNOTATION_ROTATE_HANDLE_COLOR = '#18181b';
const ANNOTATION_MINIMUM_LINE_LENGTH_PX = 8;
const ANNOTATION_EDITOR_LINE_COUNT_EPSILON = 1e-6;
const ANNOTATION_TEXT_LAYOUT_KEYS = [
  'text',
  'font_key',
  'font_size',
  'is_auto_width'
];
const ANNOTATION_TEXT_EDITOR_CARET_ALLOWANCE_PX = 2;

class AnnotationEditor {
  constructor(store, callbacks) {
    this.store = store;
    this.callbacks = callbacks || {};
    this.page_index = 0;
    this.selected_id = null;
    this.container = null;
    this.svg = null;
    this.drag_state = null;
    this.keydown_handler = null;
    this.last_click = null;
    this.is_placing_text = false;
    this.text_edit_state = null;
    this.page_height_pt = null;
    this.measure_context = null;
    this.loaded_font_keys = {};
  }

  SetPageHeightPt(page_height_pt) {
    this.page_height_pt = page_height_pt || null;
  }

  FontReferenceHeight() {
    if (this.page_height_pt) return this.page_height_pt;
    return this.OverlaySizePx().ph || 1;
  }

  GetSelectedFontSizePt() {
    const element = this.GetSelected();
    if (!element || element.type !== 'text') return 0;
    const font_size = element.font_size || 0.03;
    return Math.round(font_size * this.FontReferenceHeight());
  }

  SetSelectedFontSizePt(point_size) {
    const element = this.GetSelected();
    if (!element || element.type !== 'text') return;
    const clamped = Math.min(Math.max(Number(point_size) || 0, 4), 400);
    this.UpdateSelected({ font_size: clamped / this.FontReferenceHeight() });
  }

  Mount(overlay_container) {
    this.container = overlay_container;
    this.svg = document.createElementNS(ANNOTATION_SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 1 1');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.classList.add('annotation-overlay');
    this.container.appendChild(this.svg);
    this.AttachSvgEvents();
    this.AttachKeyboard();
    this.EnsureAnnotationFont(ANNOTATION_DEFAULT_TEXT_FONT_KEY);
  }

  ResolveFontOption(font_key) {
    return AnnotationFonts.Resolve(font_key);
  }

  EnsureAnnotationFont(font_key) {
    const font_option = this.ResolveFontOption(font_key);
    if (!document.fonts || this.loaded_font_keys[font_option.key]) return;
    document.fonts
      .load(`16px "${font_option.family}"`)
      .then(() => {
        this.loaded_font_keys[font_option.key] = true;
        this.RefreshTextLayouts(font_option.key);
        this.Render();
      })
      .catch(() => {
        this.loaded_font_keys[font_option.key] = false;
      });
  }

  TextFontFamily(element) {
    return this.ResolveFontOption(element.font_key).family;
  }

  LayoutTextLines(element) {
    if (element.is_auto_width) return String(element.text || '').split('\n');
    const font_size = element.font_size || ANNOTATION_DEFAULTS.text.font_size;
    return this.WrapTextLines(
      element.text,
      font_size,
      element.width,
      this.TextFontFamily(element)
    );
  }

  CalculateTextBoxSize(element) {
    const font_size = element.font_size || ANNOTATION_DEFAULTS.text.font_size;
    const line_height = font_size * ANNOTATION_EDITOR_LINE_HEIGHT_RATIO;
    const lines = this.LayoutTextLines(element);
    const height = lines.length * line_height;
    if (!element.is_auto_width) return { height: height };
    const font_family = this.TextFontFamily(element);
    const widest_line_width = lines.reduce(
      (widest_width, line) =>
        Math.max(
          widest_width,
          this.MeasureTextWidth(line, font_size, font_family)
        ),
      0
    );
    return {
      width: Math.max(widest_line_width, font_size / 2),
      height: height
    };
  }

  RefreshTextLayouts(font_key) {
    const elements = this.store.GetElements(this.page_index);
    elements.forEach((element, element_index) => {
      if (element.type !== 'text') return;
      if (this.ResolveFontOption(element.font_key).key !== font_key) return;
      elements[element_index] = {
        ...element,
        ...this.CalculateTextBoxSize(element)
      };
    });
  }

  UnstretchTextTransform(anchor_x, anchor_y) {
    const size = this.OverlaySizePx();
    const horizontal_scale = size.ph / size.pw;
    return `translate(${anchor_x} ${anchor_y}) scale(${horizontal_scale} 1) translate(${-anchor_x} ${-anchor_y})`;
  }

  SetPage(page_index) {
    this.CommitTextEdit();
    this.SetTextPlacement(false);
    this.page_index = page_index;
    this.selected_id = null;
    this.Render();
  }

  EmitChange() {
    if (this.callbacks.OnChange) this.callbacks.OnChange();
  }

  EmitSelect() {
    if (this.callbacks.OnSelect) this.callbacks.OnSelect(this.GetSelected());
  }

  GetSelected() {
    if (!this.selected_id) return null;
    return (
      this.store
        .GetElements(this.page_index)
        .find(item => item.id === this.selected_id) || null
    );
  }

  Render() {
    if (!this.svg) return;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const editing_id = this.text_edit_state
      ? this.text_edit_state.element_id
      : null;
    const elements = this.store.GetElements(this.page_index);
    elements.forEach(element => {
      if (editing_id && element.id === editing_id) return;
      const node = this.CreateElementNode(element);
      if (node) this.svg.appendChild(node);
    });
    if (this.selected_id && !this.text_edit_state) this.DrawSelectionHandles();
    if (this.text_edit_state) this.PositionTextEditor();
  }

  CreateElementNode(element) {
    if (element.type === 'block') return this.CreateBlockNode(element);
    if (element.type === 'text') return this.CreateTextNode(element);
    if (element.type === 'image') return this.CreateImageNode(element);
    if (element.type === 'line') return this.CreateLineNode(element);
    return null;
  }

  RotateTransform(element) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    return `rotate(${element.rotation || 0} ${cx} ${cy})`;
  }

  CreateBlockNode(element) {
    const rect = document.createElementNS(ANNOTATION_SVG_NS, 'rect');
    rect.setAttribute('x', element.x);
    rect.setAttribute('y', element.y);
    rect.setAttribute('width', element.width);
    rect.setAttribute('height', element.height);
    rect.setAttribute('fill', element.fill_color);
    rect.setAttribute(
      'fill-opacity',
      element.opacity != null ? element.opacity : 1
    );
    rect.setAttribute('transform', this.RotateTransform(element));
    rect.dataset.elementId = element.id;
    rect.style.cursor = 'move';
    return rect;
  }

  CreateTextNode(element) {
    const group = document.createElementNS(ANNOTATION_SVG_NS, 'g');
    group.setAttribute('transform', this.RotateTransform(element));
    group.dataset.elementId = element.id;
    group.style.cursor = 'move';
    const hit_rect = document.createElementNS(ANNOTATION_SVG_NS, 'rect');
    hit_rect.setAttribute('x', element.x);
    hit_rect.setAttribute('y', element.y);
    hit_rect.setAttribute('width', element.width);
    hit_rect.setAttribute(
      'height',
      Math.max(element.height, element.font_size)
    );
    hit_rect.setAttribute('fill', 'transparent');
    hit_rect.setAttribute('pointer-events', 'all');
    hit_rect.dataset.elementId = element.id;
    group.appendChild(hit_rect);
    const font_size = element.font_size || ANNOTATION_DEFAULTS.text.font_size;
    const font_family = this.TextFontFamily(element);
    this.EnsureAnnotationFont(element.font_key);
    const line_height = font_size * ANNOTATION_EDITOR_LINE_HEIGHT_RATIO;
    const lines = this.LimitTextLines(
      this.LayoutTextLines(element),
      element.height,
      line_height
    );
    const text_x = this.TextX(element);
    const text_anchor = this.TextAnchor(element.align);
    lines.forEach((line, line_index) => {
      const text_node = document.createElementNS(ANNOTATION_SVG_NS, 'text');
      const line_y = element.y + font_size + line_height * line_index;
      text_node.setAttribute('x', text_x);
      text_node.setAttribute('y', line_y);
      text_node.setAttribute(
        'transform',
        this.UnstretchTextTransform(text_x, line_y)
      );
      text_node.setAttribute('fill', element.color);
      text_node.setAttribute(
        'fill-opacity',
        element.opacity != null ? element.opacity : 1
      );
      text_node.setAttribute('font-size', font_size);
      text_node.setAttribute('font-family', font_family);
      text_node.style.fontFamily = `"${font_family}", sans-serif`;
      text_node.setAttribute('text-anchor', text_anchor);
      text_node.dataset.elementId = element.id;
      text_node.textContent = line;
      group.appendChild(text_node);
    });
    return group;
  }

  CreateImageNode(element) {
    const image = document.createElementNS(ANNOTATION_SVG_NS, 'image');
    image.setAttribute('x', element.x);
    image.setAttribute('y', element.y);
    image.setAttribute('width', element.width);
    image.setAttribute('height', element.height);
    image.setAttribute('preserveAspectRatio', 'none');
    image.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'href',
      element.image_data_url || ''
    );
    image.setAttribute('href', element.image_data_url || '');
    image.setAttribute(
      'opacity',
      element.opacity != null ? element.opacity : 1
    );
    image.setAttribute('transform', this.RotateTransform(element));
    image.dataset.elementId = element.id;
    image.style.cursor = 'move';
    return image;
  }

  CreateLineNode(element) {
    const group = document.createElementNS(ANNOTATION_SVG_NS, 'g');
    group.dataset.elementId = element.id;
    group.style.cursor = 'move';
    group.setAttribute('transform', this.RotateTransform(element));
    const opacity = element.opacity != null ? element.opacity : 1;
    const stroke_width = element.stroke_width || 0.004;
    const x1 = element.x;
    const y1 = element.y;
    const x2 = element.x + element.width;
    const y2 = element.y + element.height;
    const hit_line = document.createElementNS(ANNOTATION_SVG_NS, 'line');
    hit_line.setAttribute('x1', x1);
    hit_line.setAttribute('y1', y1);
    hit_line.setAttribute('x2', x2);
    hit_line.setAttribute('y2', y2);
    hit_line.setAttribute('stroke', 'transparent');
    hit_line.setAttribute('stroke-width', Math.max(stroke_width * 4, 0.03));
    hit_line.setAttribute('pointer-events', 'stroke');
    hit_line.dataset.elementId = element.id;
    group.appendChild(hit_line);
    const line = document.createElementNS(ANNOTATION_SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', element.stroke_color);
    line.setAttribute('stroke-width', stroke_width);
    line.setAttribute('stroke-opacity', opacity);
    line.setAttribute('pointer-events', 'none');
    group.appendChild(line);
    if (element.has_arrow) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(stroke_width * 6, 0.04);
      const spread = Math.PI / 7;
      [angle - spread, angle + spread].forEach(head_angle => {
        const barb = document.createElementNS(ANNOTATION_SVG_NS, 'line');
        barb.setAttribute('x1', x2);
        barb.setAttribute('y1', y2);
        barb.setAttribute('x2', x2 - head * Math.cos(head_angle));
        barb.setAttribute('y2', y2 - head * Math.sin(head_angle));
        barb.setAttribute('stroke', element.stroke_color);
        barb.setAttribute('stroke-width', stroke_width);
        barb.setAttribute('stroke-opacity', opacity);
        barb.setAttribute('pointer-events', 'none');
        group.appendChild(barb);
      });
    }
    return group;
  }

  AttachSvgEvents() {
    this.svg.addEventListener('pointerdown', event =>
      this.OnPointerDown(event)
    );
    this.svg.addEventListener('pointermove', event =>
      this.OnPointerMove(event)
    );
    this.svg.addEventListener('pointerup', event => this.OnPointerUp(event));
    this.svg.addEventListener('dblclick', event => this.OnDoubleClick(event));
  }

  RelativePoint(event) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  }

  OverlaySizePx() {
    const rect = this.svg ? this.svg.getBoundingClientRect() : null;
    return {
      pw: rect && rect.width ? rect.width : 1,
      ph: rect && rect.height ? rect.height : 1
    };
  }

  MeasureTextWidth(text, font_size, font_family) {
    const size = this.OverlaySizePx();
    if (!this.measure_context) {
      this.measure_context = document.createElement('canvas').getContext('2d');
    }
    this.measure_context.font = `${font_size * size.ph}px "${font_family}", sans-serif`;
    return this.measure_context.measureText(String(text || '')).width / size.pw;
  }

  WrapTextLines(text, font_size, max_width, font_family) {
    const safe_width = Math.max(Number(max_width) || 0, font_size);
    const wrapped_lines = [];
    String(text || '')
      .split('\n')
      .forEach(paragraph => {
        let current_line = '';
        Array.from(paragraph).forEach(character => {
          const candidate_line = `${current_line}${character}`;
          if (
            current_line &&
            this.MeasureTextWidth(candidate_line, font_size, font_family) >
              safe_width
          ) {
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
          ANNOTATION_EDITOR_LINE_COUNT_EPSILON
      )
    );
    return lines.slice(0, max_line_count);
  }

  TextAnchor(align) {
    if (align === 'center') return 'middle';
    if (align === 'right') return 'end';
    return 'start';
  }

  TextX(element) {
    if (element.align === 'center') return element.x + element.width / 2;
    if (element.align === 'right') return element.x + element.width;
    return element.x;
  }

  RotatePointBox(px, py, cx, cy, degrees) {
    const angle = (degrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }

  ApplyVisualRatioHeight(width_rel, ratio_w, ratio_h) {
    const size = this.OverlaySizePx();
    return width_rel * (size.pw / size.ph) * (ratio_h / ratio_w);
  }

  SetSelectedRatio(ratio_w, ratio_h) {
    const element = this.GetSelected();
    if (!element || !ratio_w || !ratio_h) return;
    this.UpdateSelected({
      height: this.ApplyVisualRatioHeight(element.width, ratio_w, ratio_h)
    });
  }

  Select(element_id) {
    this.selected_id = element_id;
    this.Render();
    this.EmitSelect();
  }

  CreateElement(type, extra) {
    const defaults = ANNOTATION_DEFAULTS[type];
    const extra_options = extra || {};
    const width =
      extra_options.width != null ? extra_options.width : defaults.width;
    let height =
      extra_options.height != null ? extra_options.height : defaults.height;
    if (type === 'image' && extra_options.natural_ratio) {
      height = this.ApplyVisualRatioHeight(
        width,
        extra_options.natural_ratio,
        1
      );
    }
    const element = Object.assign(
      { type: type, rotation: 0 },
      defaults,
      extra_options,
      { x: 0.5 - width / 2, y: 0.5 - height / 2, width: width, height: height }
    );
    const added = this.store.AddElement(this.page_index, element);
    this.Select(added.id);
    this.EmitChange();
  }

  UpdateSelected(patch) {
    if (!this.selected_id) return;
    const element = this.GetSelected();
    const is_text_layout_patch =
      element &&
      element.type === 'text' &&
      ANNOTATION_TEXT_LAYOUT_KEYS.some(key => key in patch);
    const layout_patch = is_text_layout_patch
      ? this.CalculateTextBoxSize({ ...element, ...patch })
      : {};
    this.store.UpdateElement(this.page_index, this.selected_id, {
      ...patch,
      ...layout_patch
    });
    this.Render();
    this.EmitChange();
  }

  DeleteSelected() {
    if (!this.selected_id) return;
    this.store.DeleteElement(this.page_index, this.selected_id);
    this.selected_id = null;
    this.Render();
    this.EmitSelect();
    this.EmitChange();
  }

  MoveSelected(direction) {
    if (!this.selected_id) return;
    this.store.MoveElement(this.page_index, this.selected_id, direction);
    this.Render();
    this.EmitChange();
  }

  DrawSelectionHandles() {
    const element = this.GetSelected();
    if (!element) return;
    if (element.type === 'line') {
      this.DrawLineEndpointHandles(element);
      return;
    }
    const box = document.createElementNS(ANNOTATION_SVG_NS, 'rect');
    box.setAttribute('x', element.x);
    box.setAttribute('y', element.y);
    box.setAttribute('width', element.width);
    box.setAttribute('height', Math.max(element.height, 0.001));
    box.setAttribute('fill', 'none');
    box.setAttribute('stroke', ANNOTATION_SELECTION_COLOR);
    box.setAttribute('stroke-width', '1.5');
    box.setAttribute('stroke-dasharray', '4 3');
    box.setAttribute('vector-effect', 'non-scaling-stroke');
    box.setAttribute('transform', this.RotateTransform(element));
    box.setAttribute('pointer-events', 'none');
    this.svg.appendChild(box);
    const size = this.OverlaySizePx();
    const center_x = element.x + element.width / 2;
    const center_y = element.y + element.height / 2;
    const rotation = element.rotation || 0;
    const handle_specs = [
      {
        key: 'resize',
        ax: element.x + element.width,
        ay: element.y + element.height,
        color: ANNOTATION_SELECTION_COLOR,
        icon: '',
        cursor: 'nwse-resize'
      },
      {
        key: 'rotate',
        ax: center_x,
        ay: element.y - 26 / size.ph,
        color: ANNOTATION_ROTATE_HANDLE_COLOR,
        icon: '↻',
        cursor: 'grab'
      }
    ];
    handle_specs.forEach(spec => {
      const anchor = this.RotatePointBox(
        spec.ax,
        spec.ay,
        center_x,
        center_y,
        rotation
      );
      this.AppendHandle(element.id, anchor, spec);
    });
  }

  DrawLineEndpointHandles(element) {
    const endpoints = AnnotationGeometry.LineEndpoints(element);
    [
      { key: 'line-start', anchor: endpoints.start },
      { key: 'line-end', anchor: endpoints.end }
    ].forEach(endpoint => {
      this.AppendHandle(element.id, endpoint.anchor, {
        key: endpoint.key,
        color: '#ffffff',
        border_color: ANNOTATION_SELECTION_COLOR,
        radius: 7,
        icon: '',
        cursor: 'crosshair'
      });
    });
  }

  AppendHandle(element_id, anchor, spec) {
    const size = this.OverlaySizePx();
    const handle_group = document.createElementNS(ANNOTATION_SVG_NS, 'g');
    handle_group.setAttribute(
      'transform',
      `translate(${anchor.x} ${anchor.y}) scale(${1 / size.pw} ${1 / size.ph})`
    );
    const dot = document.createElementNS(ANNOTATION_SVG_NS, 'circle');
    dot.setAttribute('cx', '0');
    dot.setAttribute('cy', '0');
    dot.setAttribute('r', String(spec.radius || 9));
    dot.setAttribute('fill', spec.color);
    dot.setAttribute('stroke', spec.border_color || '#ffffff');
    dot.setAttribute('stroke-width', spec.border_color ? '2.5' : '2');
    dot.dataset.handle = spec.key;
    dot.dataset.elementId = element_id;
    dot.style.cursor = spec.cursor;
    handle_group.appendChild(dot);
    if (spec.icon) {
      const glyph = document.createElementNS(ANNOTATION_SVG_NS, 'text');
      glyph.setAttribute('x', '0');
      glyph.setAttribute('y', '0');
      glyph.setAttribute('text-anchor', 'middle');
      glyph.setAttribute('dominant-baseline', 'central');
      glyph.setAttribute('font-size', '12');
      glyph.setAttribute('fill', '#ffffff');
      glyph.setAttribute('pointer-events', 'none');
      glyph.textContent = spec.icon;
      handle_group.appendChild(glyph);
    }
    this.svg.appendChild(handle_group);
  }

  CalculateLineEndpointPatch(origin, point, should_snap) {
    const endpoints = AnnotationGeometry.LineEndpoints(origin);
    const is_start_dragged = this.drag_state.mode === 'line-start';
    const fixed_point = is_start_dragged ? endpoints.end : endpoints.start;
    const size = this.OverlaySizePx();
    const dragged_point = should_snap
      ? AnnotationGeometry.SnapLineEndpoint(
          fixed_point,
          point,
          size.pw,
          size.ph
        )
      : point;
    const length_px = Math.hypot(
      (dragged_point.x - fixed_point.x) * size.pw,
      (dragged_point.y - fixed_point.y) * size.ph
    );
    if (length_px < ANNOTATION_MINIMUM_LINE_LENGTH_PX) return null;
    return is_start_dragged
      ? AnnotationGeometry.LineFromEndpoints(dragged_point, fixed_point)
      : AnnotationGeometry.LineFromEndpoints(fixed_point, dragged_point);
  }

  OnPointerDown(event) {
    this.CommitTextEdit();
    if (this.is_placing_text) {
      event.preventDefault();
      this.SetTextPlacement(false);
      this.StartNewText(this.RelativePoint(event));
      return;
    }
    const target = event.target;
    const handle = target.dataset ? target.dataset.handle : null;
    const element_id = target.dataset ? target.dataset.elementId : null;
    if (!element_id) {
      this.Select(null);
      return;
    }
    const element = this.store
      .GetElements(this.page_index)
      .find(item => item.id === element_id);
    if (!element) return;
    const now = Date.now();
    if (
      !handle &&
      this.last_click &&
      this.last_click.id === element_id &&
      now - this.last_click.time < 350
    ) {
      this.last_click = null;
      if (element.type === 'text') {
        event.preventDefault();
        this.EditTextElement(element_id);
        return;
      }
    }
    this.last_click = { id: element_id, time: now };
    this.selected_id = element_id;
    this.drag_state = {
      mode: handle || 'move',
      start: this.RelativePoint(event),
      origin: { ...element }
    };
    this.svg.setPointerCapture(event.pointerId);
    this.Render();
    this.EmitSelect();
  }

  OnPointerMove(event) {
    if (!this.drag_state) return;
    const point = this.RelativePoint(event);
    const dx = point.x - this.drag_state.start.x;
    const dy = point.y - this.drag_state.start.y;
    const origin = this.drag_state.origin;
    let patch = {};
    if (this.drag_state.mode === 'move') {
      patch = { x: origin.x + dx, y: origin.y + dy };
    } else if (this.drag_state.mode === 'resize') {
      const next_width = Math.max(origin.width + dx, 0.01);
      if (origin.type === 'text') {
        const resized_text = {
          ...origin,
          width: next_width,
          is_auto_width: false
        };
        patch = {
          width: next_width,
          is_auto_width: false,
          height: this.CalculateTextBoxSize(resized_text).height
        };
      } else {
        const next_height =
          origin.type === 'image' && origin.natural_ratio && !event.shiftKey
            ? this.ApplyVisualRatioHeight(next_width, origin.natural_ratio, 1)
            : Math.max(origin.height + dy, 0.001);
        patch = {
          width: next_width,
          height: next_height
        };
      }
    } else if (
      this.drag_state.mode === 'line-start' ||
      this.drag_state.mode === 'line-end'
    ) {
      patch = this.CalculateLineEndpointPatch(origin, point, event.shiftKey);
      if (!patch) return;
    } else if (this.drag_state.mode === 'rotate') {
      const cx = origin.x + origin.width / 2;
      const cy = origin.y + origin.height / 2;
      const angle =
        (Math.atan2(point.y - cy, point.x - cx) * 180) / Math.PI + 90;
      const snapped = event.shiftKey ? Math.round(angle / 15) * 15 : angle;
      patch = { rotation: ((Math.round(snapped) % 360) + 360) % 360 };
    }
    const elements = this.store.GetElements(this.page_index);
    const index = elements.findIndex(item => item.id === this.selected_id);
    if (index >= 0) {
      elements[index] = { ...elements[index], ...patch };
      this.Render();
    }
  }

  OnPointerUp() {
    if (!this.drag_state) return;
    const element = this.GetSelected();
    if (element) {
      const origin = this.drag_state.origin;
      const changed =
        origin.x !== element.x ||
        origin.y !== element.y ||
        origin.width !== element.width ||
        origin.height !== element.height ||
        origin.rotation !== element.rotation;
      if (changed) {
        const current = { ...element };
        const elements = this.store.GetElements(this.page_index);
        const index = elements.findIndex(item => item.id === element.id);
        elements[index] = origin;
        this.store.UpdateElement(this.page_index, element.id, current);
        this.EmitChange();
      }
    }
    this.drag_state = null;
    this.EmitSelect();
  }

  OnDoubleClick(event) {
    const element_id = event.target.dataset
      ? event.target.dataset.elementId
      : null;
    if (!element_id) return;
    const element = this.store
      .GetElements(this.page_index)
      .find(item => item.id === element_id);
    if (!element || element.type !== 'text') return;
    this.selected_id = element_id;
    this.EditTextElement(element_id);
  }

  EditSelectedText() {
    const element = this.GetSelected();
    if (!element || element.type !== 'text') return;
    this.EditTextElement(element.id);
  }

  EditTextElement(element_id) {
    if (
      this.text_edit_state &&
      this.text_edit_state.element_id === element_id
    ) {
      return;
    }
    const element = this.store
      .GetElements(this.page_index)
      .find(item => item.id === element_id);
    if (!element || element.type !== 'text') return;
    this.CommitTextEdit();
    this.selected_id = element_id;
    this.OpenTextEditor({ ...element }, false);
  }

  ToggleTextPlacement() {
    this.SetTextPlacement(!this.is_placing_text);
  }

  SetTextPlacement(is_placing) {
    const next_is_placing = Boolean(is_placing) && Boolean(this.svg);
    this.is_placing_text = next_is_placing;
    if (this.svg) this.svg.style.cursor = next_is_placing ? 'text' : '';
    if (this.callbacks.OnTextPlacementChange) {
      this.callbacks.OnTextPlacementChange(next_is_placing);
    }
  }

  StartNewText(point) {
    const draft = {
      type: 'text',
      rotation: 0,
      ...ANNOTATION_DEFAULTS.text,
      x: Math.min(Math.max(point.x, 0), 1),
      y: Math.min(Math.max(point.y, 0), 1)
    };
    this.selected_id = null;
    this.OpenTextEditor(
      { ...draft, ...this.CalculateTextBoxSize(draft) },
      true
    );
  }

  OpenTextEditor(draft, is_new) {
    if (!this.container) return;
    const textarea = document.createElement('textarea');
    textarea.className = 'annotation-text-editor';
    textarea.value = String(draft.text || '');
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', 'พิมพ์ข้อความ');
    this.text_edit_state = {
      element_id: is_new ? null : draft.id,
      is_new: is_new,
      original_text: textarea.value,
      draft: draft,
      textarea: textarea
    };
    textarea.addEventListener('input', () => this.OnTextEditorInput());
    textarea.addEventListener('keydown', event =>
      this.OnTextEditorKeyDown(event)
    );
    textarea.addEventListener('blur', () => this.CommitTextEdit());
    this.container.appendChild(textarea);
    this.EnsureAnnotationFont(draft.font_key);
    this.Render();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  PositionTextEditor() {
    const state = this.text_edit_state;
    if (!state) return;
    const draft = state.draft;
    const size = this.OverlaySizePx();
    const font_size_px =
      (draft.font_size || ANNOTATION_DEFAULTS.text.font_size) * size.ph;
    const caret_allowance_px = draft.is_auto_width
      ? ANNOTATION_TEXT_EDITOR_CARET_ALLOWANCE_PX
      : 0;
    const textarea_style = state.textarea.style;
    textarea_style.left = `${draft.x * size.pw}px`;
    textarea_style.top = `${draft.y * size.ph}px`;
    textarea_style.width = `${draft.width * size.pw + caret_allowance_px}px`;
    textarea_style.height = `${draft.height * size.ph}px`;
    textarea_style.fontFamily = `"${this.TextFontFamily(draft)}", sans-serif`;
    textarea_style.fontSize = `${font_size_px}px`;
    textarea_style.lineHeight = `${font_size_px * ANNOTATION_EDITOR_LINE_HEIGHT_RATIO}px`;
    textarea_style.color = draft.color || ANNOTATION_DEFAULTS.text.color;
    textarea_style.opacity = String(draft.opacity != null ? draft.opacity : 1);
    textarea_style.textAlign = draft.align || 'left';
    textarea_style.transform = `rotate(${draft.rotation || 0}deg)`;
    state.textarea.wrap = draft.is_auto_width ? 'off' : 'soft';
    state.textarea.classList.toggle(
      'is-auto-width',
      Boolean(draft.is_auto_width)
    );
  }

  OnTextEditorInput() {
    const state = this.text_edit_state;
    if (!state) return;
    const next_draft = { ...state.draft, text: state.textarea.value };
    state.draft = { ...next_draft, ...this.CalculateTextBoxSize(next_draft) };
    this.PositionTextEditor();
  }

  OnTextEditorKeyDown(event) {
    event.stopPropagation();
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.CancelTextEdit();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.CommitTextEdit();
    }
  }

  CloseTextEditor() {
    const state = this.text_edit_state;
    if (!state) return null;
    this.text_edit_state = null;
    if (state.textarea.parentNode) {
      state.textarea.parentNode.removeChild(state.textarea);
    }
    return state;
  }

  CancelTextEdit() {
    if (!this.CloseTextEditor()) return;
    this.Render();
  }

  CommitTextEdit() {
    const state = this.CloseTextEditor();
    if (!state) return;
    const next_text = state.textarea.value;
    const has_text = next_text.trim() !== '';
    const layout = this.CalculateTextBoxSize({
      ...state.draft,
      text: next_text
    });
    let has_selection_changed = false;
    if (state.is_new) {
      if (has_text) {
        const added = this.store.AddElement(this.page_index, {
          ...state.draft,
          text: next_text,
          ...layout
        });
        this.selected_id = added.id;
        has_selection_changed = true;
        this.EmitChange();
      }
    } else if (!has_text) {
      this.store.DeleteElement(this.page_index, state.element_id);
      this.selected_id = null;
      has_selection_changed = true;
      this.EmitChange();
    } else if (next_text !== state.original_text) {
      this.store.UpdateElement(this.page_index, state.element_id, {
        text: next_text,
        ...layout
      });
      this.EmitChange();
    }
    this.Render();
    if (has_selection_changed) this.EmitSelect();
  }

  AttachKeyboard() {
    this.keydown_handler = event => {
      if (!this.svg) return;
      const tag = event.target && event.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selected_id) {
          event.preventDefault();
          this.DeleteSelected();
        }
      } else if (event.key === 'Escape') {
        if (this.is_placing_text) {
          this.SetTextPlacement(false);
          return;
        }
        this.Select(null);
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        if (event.shiftKey) this.Redo();
        else this.Undo();
      } else if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        if (this.selected_id) {
          event.preventDefault();
          const size = this.OverlaySizePx();
          const step_x = (event.shiftKey ? 10 : 1) / size.pw;
          const step_y = (event.shiftKey ? 10 : 1) / size.ph;
          const move_x =
            event.key === 'ArrowLeft'
              ? -step_x
              : event.key === 'ArrowRight'
                ? step_x
                : 0;
          const move_y =
            event.key === 'ArrowUp'
              ? -step_y
              : event.key === 'ArrowDown'
                ? step_y
                : 0;
          const element = this.GetSelected();
          if (element) {
            this.UpdateSelected({
              x: element.x + move_x,
              y: element.y + move_y
            });
          }
        }
      }
    };
    document.addEventListener('keydown', this.keydown_handler);
  }

  Undo() {
    if (this.store.Undo()) {
      this.Render();
      this.EmitSelect();
      this.EmitChange();
    }
  }
  Redo() {
    if (this.store.Redo()) {
      this.Render();
      this.EmitSelect();
      this.EmitChange();
    }
  }

  Unmount() {
    this.CommitTextEdit();
    this.SetTextPlacement(false);
    if (this.keydown_handler)
      document.removeEventListener('keydown', this.keydown_handler);
    if (this.svg && this.svg.parentNode)
      this.svg.parentNode.removeChild(this.svg);
    this.svg = null;
    this.container = null;
    this.selected_id = null;
    this.drag_state = null;
  }
}
