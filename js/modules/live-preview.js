const LIVE_PREVIEW_DELAY_MS = 400;

class LivePreviewScheduler {
  constructor(RenderPreview, delay_ms = LIVE_PREVIEW_DELAY_MS) {
    this.RenderPreview = RenderPreview;
    this.delay_ms = delay_ms;
    this.pending_timer = null;
    this.latest_request_id = 0;
  }

  Schedule() {
    this.ClearPendingTimer();
    this.pending_timer = setTimeout(() => {
      this.pending_timer = null;
      this.latest_request_id += 1;
      this.RenderPreview(this.latest_request_id);
    }, this.delay_ms);
  }

  IsLatest(request_id) {
    return request_id === this.latest_request_id;
  }

  Cancel() {
    this.ClearPendingTimer();
    this.latest_request_id += 1;
  }

  ClearPendingTimer() {
    if (this.pending_timer === null) return;
    clearTimeout(this.pending_timer);
    this.pending_timer = null;
  }
}
