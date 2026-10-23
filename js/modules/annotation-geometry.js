const LINE_SNAP_STEP_DEGREES = 15;

const AnnotationGeometry = {
  NormalizeRotation(rotation) {
    return (((Number(rotation) || 0) % 360) + 360) % 360;
  },

  VisibleSize(page_width, page_height, rotation) {
    const normalized = this.NormalizeRotation(rotation);
    if (normalized === 90 || normalized === 270) {
      return { width: page_height, height: page_width };
    }
    return { width: page_width, height: page_height };
  },

  VisiblePointToUser(u, v, page_width, page_height, rotation) {
    const normalized = this.NormalizeRotation(rotation);
    if (normalized === 90) {
      return { x: v, y: u };
    }
    if (normalized === 180) {
      return { x: page_width - u, y: v };
    }
    if (normalized === 270) {
      return { x: page_width - v, y: page_height - u };
    }
    return { x: u, y: page_height - v };
  },

  RelToVisibleRect(element, visible_width, visible_height) {
    const width = element.width * visible_width;
    const height = element.height * visible_height;
    return {
      center_u: element.x * visible_width + width / 2,
      center_v: element.y * visible_height + height / 2,
      width: width,
      height: height
    };
  },

  UserSize(width_visible, height_visible, rotation) {
    const normalized = this.NormalizeRotation(rotation);
    if (normalized === 90 || normalized === 270) {
      return { width: height_visible, height: width_visible };
    }
    return { width: width_visible, height: height_visible };
  },

  UserDrawAngle(element_rotation, page_rotation) {
    const total =
      (Number(element_rotation) || 0) + (Number(page_rotation) || 0);
    return -(((total % 360) + 360) % 360) || 0;
  },

  // Lines are stored as a start point (x, y) and a signed size; a legacy
  // rotation turns both endpoints around the box center in overlay space.
  LineEndpoints(element) {
    const center_x = element.x + element.width / 2;
    const center_y = element.y + element.height / 2;
    const angle = ((Number(element.rotation) || 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const RotatePoint = (point_x, point_y) => {
      const offset_x = point_x - center_x;
      const offset_y = point_y - center_y;
      return {
        x: center_x + offset_x * cos - offset_y * sin,
        y: center_y + offset_x * sin + offset_y * cos
      };
    };
    return {
      start: RotatePoint(element.x, element.y),
      end: RotatePoint(element.x + element.width, element.y + element.height)
    };
  },

  LineFromEndpoints(start, end) {
    return {
      x: start.x,
      y: start.y,
      width: end.x - start.x,
      height: end.y - start.y,
      rotation: 0
    };
  },

  // Snaps in screen pixels so the angle matches what the user sees on a
  // non-square page, keeping the dragged length.
  SnapLineEndpoint(anchor, point, overlay_width_px, overlay_height_px) {
    const vector_x_px = (point.x - anchor.x) * overlay_width_px;
    const vector_y_px = (point.y - anchor.y) * overlay_height_px;
    const length_px = Math.hypot(vector_x_px, vector_y_px);
    const step_radians = (LINE_SNAP_STEP_DEGREES * Math.PI) / 180;
    const snapped_angle =
      Math.round(Math.atan2(vector_y_px, vector_x_px) / step_radians) *
      step_radians;
    return {
      x: anchor.x + (length_px * Math.cos(snapped_angle)) / overlay_width_px,
      y: anchor.y + (length_px * Math.sin(snapped_angle)) / overlay_height_px
    };
  },

  CenterToCorner(center_x, center_y, width, height, angle_degrees) {
    const angle = (angle_degrees * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const local_x = -width / 2;
    const local_y = -height / 2;
    return {
      x: center_x + (local_x * cos - local_y * sin),
      y: center_y + (local_x * sin + local_y * cos)
    };
  }
};
