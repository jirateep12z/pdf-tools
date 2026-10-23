const MAXIMUM_COMPRESSION_FILE_SIZE_BYTES = 50 * BYTES_PER_MB;
const MAXIMUM_COMPRESSION_FILE_SIZE_LABEL = '50 MB';
const COMPRESSION_LEVEL_LABELS = Object.freeze({
  low: 'ต่ำ',
  medium: 'กลาง',
  high: 'สูง'
});
const SPLIT_RANGE_HELP_TEXTS = Object.freeze({
  split: 'หน้าที่จะรวมเป็น PDF ใหม่ ตามลำดับที่พิมพ์',
  extract_images: 'หน้าที่จะแปลงเป็นภาพ PNG ตามลำดับที่พิมพ์'
});

const PDF_TOOL_CONFIG = {
  merge: {
    title: 'รวม PDF',
    description: 'รวม PDF หลายไฟล์เป็นไฟล์เดียว',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'merged.pdf',
    allows_multiple_files: true
  },
  split: {
    title: 'แยก PDF',
    description: 'แยก PDF ตามช่วงหน้าที่กำหนด',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'split.pdf',
    allows_multiple_files: false
  },
  organize: {
    title: 'จัดเรียง / ลบ / หมุนหน้า',
    description: 'จัดเรียง ลบ และหมุนหน้าก่อนส่งออก',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'organized.pdf',
    allows_multiple_files: true
  },
  images_to_pdf: {
    title: 'รูปภาพเป็น PDF',
    description: 'แปลง JPG, PNG และ WebP เป็น PDF',
    accepted_file_types: IMAGE_FILE_TYPES,
    output_file_name: 'images.pdf',
    allows_multiple_files: true
  },
  extract_text: {
    title: 'ดึงข้อความ',
    description: 'ดึงข้อความจาก PDF ที่มี text layer',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'extracted-text.txt',
    allows_multiple_files: true
  },
  extract_images: {
    title: 'แปลงหน้าเป็นรูปภาพ',
    description: 'แปลงแต่ละหน้า PDF เป็น PNG และรวมเป็น ZIP',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'pdf-images.zip',
    allows_multiple_files: false
  },
  compress: {
    title: 'บีบอัด PDF',
    description: 'เลือกระดับเพื่อลดขนาด PDF ภายในเบราว์เซอร์',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'compressed.pdf',
    allows_multiple_files: false
  },
  watermark: {
    title: 'ใส่ลายน้ำ',
    description: 'เพิ่มข้อความลายน้ำลงทุกหน้า',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'watermarked.pdf',
    allows_multiple_files: false
  },
  page_numbers: {
    title: 'ใส่เลขหน้า',
    description: 'เพิ่มเลขหน้าที่ด้านบนหรือด้านล่างของ PDF',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'numbered.pdf',
    allows_multiple_files: false
  },
  annotate: {
    title: 'เขียน / วาดบนหน้า',
    description: 'วางข้อความ กล่องสี รูปภาพ และเส้น/ลูกศรลงบนหน้า PDF',
    accepted_file_types: [PDF_FILE_TYPE],
    output_file_name: 'annotated.pdf',
    allows_multiple_files: false
  }
};

const HOME_DOCUMENT_TITLE = 'PDF Tools - เครื่องมือจัดการ PDF';

class PdfApp {
  constructor() {
    this.file_module = new PdfFileModule();
    this.file_name_display_module = new FileNameDisplayModule();
    this.preview_module = new PdfPreviewModule(this);
    this.render_module = new PdfRenderModule();
    this.operation_module = new PdfOperationModule(this.render_module);
    this.text_module = new PdfTextModule();
    this.download_module = new PdfDownloadModule();
    this.output_summary_module = new OutputSummaryModule(this.file_module);
    this.toast_module = new ToastModule(
      document.getElementById('toast-region')
    );
    this.live_preview_scheduler = new LivePreviewScheduler(request_id =>
      this.RenderLivePreview(request_id)
    );
    this.compress_preview_scheduler = new LivePreviewScheduler(request_id =>
      this.RenderCompressPreview(request_id)
    );
    this.compress_preview_url = '';
    this.annotation_store = new AnnotationStore();
    this.annotation_export = new AnnotationExport();
    this.annotation_editor = new AnnotationEditor(this.annotation_store, {
      OnChange: () => {},
      OnSelect: selected => this.RenderAnnotateInspector(selected),
      OnTextPlacementChange: is_placing =>
        this.UpdateTextPlacementButton(is_placing)
    });
    this.is_annotate_mounted = false;
    this.selected_tool = '';
    this.uploaded_files = [];
    this.page_operations = [];
    this.split_pages = [];
    this.split_selected_page_indexes = new Set();
    this.extracted_text_files = [];
    this.preview_pages = [];
    this.preview_current_page_index = 0;
    this.processing_status = 'idle';
    this.error_message = '';
    this.file_state_generation = 0;
    this.file_read_sequence = 0;
    this.preview_render_sequence = 0;
    this.workspace_drag_depth = 0;
    this.InitializeElements();
    this.InitializeDarkMode();
    this.AttachEventListeners();
    this.RenderToolOverview();
    this.RouteFromLocation('replace');
    this.ShowDependencyWarnings();
  }

  InitializeElements() {
    this.elements = {
      tool_buttons: document.querySelectorAll('[data-pdf-tool]'),
      tool_title: document.getElementById('pdf-tool-title'),
      tool_description: document.getElementById('pdf-tool-description'),
      file_input: document.getElementById('pdf-file-input'),
      upload_section: document.getElementById('pdf-upload-section'),
      split_range_input: document.getElementById('split-range-input'),
      split_options: document.getElementById('split-options'),
      split_range_hint: document.getElementById('split-range-hint'),
      split_range_help: document.getElementById('split-range-help'),
      organize_options: document.getElementById('organize-options'),
      merge_workspace: document.getElementById('merge-workspace'),
      split_workspace: document.getElementById('split-workspace'),
      text_workspace: document.getElementById('text-workspace'),
      copy_text_button: document.getElementById('copy-text-button'),
      watermark_options: document.getElementById('watermark-options'),
      watermark_text: document.getElementById('watermark-text'),
      watermark_size: document.getElementById('watermark-size'),
      watermark_opacity: document.getElementById('watermark-opacity'),
      watermark_rotation: document.getElementById('watermark-rotation'),
      watermark_position: document.getElementById('watermark-position'),
      watermark_color: document.getElementById('watermark-color'),
      watermark_pattern: document.getElementById('watermark-pattern'),
      watermark_offset_x: document.getElementById('watermark-offset-x'),
      watermark_offset_y: document.getElementById('watermark-offset-y'),
      watermark_pattern_gap_options: document.getElementById(
        'watermark-pattern-gap-options'
      ),
      watermark_gap_x: document.getElementById('watermark-gap-x'),
      watermark_gap_y: document.getElementById('watermark-gap-y'),
      watermark_page_range: document.getElementById('watermark-page-range'),
      page_number_options: document.getElementById('page-number-options'),
      annotate_options: document.getElementById('annotate-options'),
      annotate_overlay: document.getElementById('annotate-overlay'),
      annotate_inspector: document.getElementById('annotate-inspector'),
      annotate_image_input: document.getElementById('annotate-image-input'),
      page_number_format: document.getElementById('page-number-format'),
      page_number_position: document.getElementById('page-number-position'),
      page_number_start: document.getElementById('page-number-start'),
      page_number_range: document.getElementById('page-number-range'),
      compression_options: document.getElementById('compression-options'),
      compression_level_inputs: document.querySelectorAll(
        'input[name="compression-level"]'
      ),
      compression_warning: document.getElementById('compression-warning'),
      compression_info: document.getElementById('compression-info'),
      compression_original_size: document.getElementById(
        'compression-original-size'
      ),
      compression_compressed_size: document.getElementById(
        'compression-compressed-size'
      ),
      compression_reduction: document.getElementById('compression-reduction'),
      compression_level_result: document.getElementById(
        'compression-level-result'
      ),
      process_button: document.getElementById('process-pdf-button'),
      status_message: document.getElementById('pdf-status-message'),
      workspace: document.getElementById('pdf-workspace'),
      workspace_drop_accept: document.getElementById('workspace-drop-accept'),
      workspace_drop_select_button: document.getElementById(
        'workspace-drop-select-button'
      ),
      workspace_drop_overlay: document.getElementById('workspace-drop-overlay'),
      workspace_drop_overlay_text: document.getElementById(
        'workspace-drop-overlay-text'
      ),
      workspace_busy_indicator: document.getElementById(
        'workspace-busy-indicator'
      ),
      workspace_busy_text: document.getElementById('workspace-busy-text'),
      live_preview_hint: document.getElementById('live-preview-hint'),
      compress_compare_figure: document.getElementById(
        'compress-compare-figure'
      ),
      compress_compare_image: document.getElementById('compress-compare-image'),
      compress_compare_caption: document.getElementById(
        'compress-compare-caption'
      ),
      compress_original_caption: document.getElementById(
        'compress-original-caption'
      ),
      compress_compare_warning: document.getElementById(
        'compress-compare-warning'
      ),
      error_message: document.getElementById('pdf-error-message'),
      preview_image: document.getElementById('pdf-preview-image'),
      preview_placeholder: document.getElementById('pdf-preview-placeholder'),
      preview_meta: document.getElementById('pdf-preview-meta'),
      preview_previous_button: document.getElementById(
        'pdf-preview-previous-button'
      ),
      preview_next_button: document.getElementById('pdf-preview-next-button'),
      preview_page_indicator: document.getElementById(
        'pdf-preview-page-indicator'
      ),
      dark_mode_toggle: document.getElementById('dark-mode-toggle'),
      dark_mode_icon: document.getElementById('dark-mode-icon')
    };
  }

  AttachEventListeners() {
    this.elements.tool_buttons.forEach(tool_button => {
      tool_button.addEventListener('click', async () => {
        await this.SelectTool(tool_button.dataset.pdfTool);
      });
    });
    window.addEventListener('popstate', () => {
      this.RouteFromLocation('none');
    });
    document
      .getElementById('show-tool-overview-button')
      ?.addEventListener('click', () => {
        this.ShowToolOverview('push');
      });
    this.elements.file_input?.addEventListener('change', event => {
      this.HandleFileSelection(event);
    });
    this.elements.split_range_input?.addEventListener('input', () => {
      this.HandleSplitRangeInput();
    });
    [
      this.elements.watermark_text,
      this.elements.watermark_size,
      this.elements.watermark_opacity,
      this.elements.watermark_rotation,
      this.elements.watermark_position,
      this.elements.watermark_color,
      this.elements.watermark_pattern,
      this.elements.watermark_offset_x,
      this.elements.watermark_offset_y,
      this.elements.watermark_gap_x,
      this.elements.watermark_gap_y,
      this.elements.watermark_page_range,
      this.elements.page_number_format,
      this.elements.page_number_position,
      this.elements.page_number_start,
      this.elements.page_number_range
    ].forEach(setting_element => {
      setting_element?.addEventListener('input', () =>
        this.ScheduleLivePreview()
      );
      setting_element?.addEventListener('change', () =>
        this.ScheduleLivePreview()
      );
    });
    this.elements.watermark_pattern?.addEventListener('change', () => {
      this.UpdateWatermarkPatternGapVisibility();
    });
    this.UpdateWatermarkPatternGapVisibility();
    this.elements.upload_section?.addEventListener('dragover', event => {
      this.HandleDragOver(event);
    });
    this.elements.upload_section?.addEventListener('drop', event => {
      this.HandleDrop(event);
    });
    this.elements.workspace?.addEventListener('dragenter', event => {
      if (!this.IsFileDrag(event)) return;
      this.workspace_drag_depth += 1;
      this.ShowWorkspaceDropOverlay();
    });
    this.elements.workspace?.addEventListener('dragover', event => {
      if (!this.IsFileDrag(event)) return;
      this.HandleDragOver(event);
    });
    this.elements.workspace?.addEventListener('dragleave', event => {
      if (!this.IsFileDrag(event)) return;
      if (
        !event.relatedTarget ||
        !this.elements.workspace.contains(event.relatedTarget)
      ) {
        this.ResetWorkspaceDrag();
        return;
      }
      this.workspace_drag_depth = Math.max(0, this.workspace_drag_depth - 1);
      if (this.workspace_drag_depth === 0) {
        this.HideWorkspaceDropOverlay();
      }
    });
    this.elements.workspace?.addEventListener('drop', event => {
      if (!this.IsFileDrag(event)) return;
      this.ResetWorkspaceDrag();
      this.HandleDrop(event);
    });
    window.addEventListener('dragend', () => {
      this.ResetWorkspaceDrag();
    });
    this.elements.workspace_drop_select_button?.addEventListener(
      'click',
      () => {
        this.elements.file_input?.click();
      }
    );
    this.elements.process_button?.addEventListener('click', () => {
      this.ProcessSelectedTool();
    });
    this.elements.copy_text_button?.addEventListener('click', () => {
      this.CopyExtractedText();
    });
    this.elements.preview_previous_button?.addEventListener('click', () => {
      this.PreviewPreviousPage();
    });
    this.elements.preview_next_button?.addEventListener('click', () => {
      this.PreviewNextPage();
    });
    this.elements.dark_mode_toggle?.addEventListener('click', () => {
      this.ToggleDarkMode();
    });
    this.elements.compression_level_inputs.forEach(compression_level_input => {
      compression_level_input.addEventListener('change', () => {
        this.UpdateCompressionWarning();
        this.ScheduleCompressPreview();
      });
    });
    document
      .getElementById('annotate-add-text')
      ?.addEventListener('click', () => {
        this.annotation_editor.ToggleTextPlacement();
      });
    document
      .getElementById('annotate-add-block')
      ?.addEventListener('click', () => {
        this.annotation_editor.CreateElement('block', {});
      });
    document
      .getElementById('annotate-add-line')
      ?.addEventListener('click', () => {
        this.annotation_editor.CreateElement('line', {});
      });
    document
      .getElementById('annotate-add-image')
      ?.addEventListener('click', () => {
        this.elements.annotate_image_input?.click();
      });
    document.getElementById('annotate-undo')?.addEventListener('click', () => {
      this.annotation_editor.Undo();
    });
    document.getElementById('annotate-redo')?.addEventListener('click', () => {
      this.annotation_editor.Redo();
    });
    this.elements.annotate_image_input?.addEventListener('change', event => {
      this.HandleAnnotateImage(event);
    });
    this.elements.preview_image?.addEventListener('load', () => {
      this.SyncOverlayToImage();
    });
    window.addEventListener('resize', () => {
      this.SyncOverlayToImage();
      if (this.is_annotate_mounted) {
        this.annotation_editor.Render();
      }
    });
  }

  ConvertToolKeyToSlug(tool_key) {
    return tool_key.replace(/_/g, '-');
  }

  ReadToolFromHash() {
    let tool_key = '';
    try {
      tool_key = decodeURIComponent(window.location.hash.slice(1)).replace(
        /-/g,
        '_'
      );
    } catch (error) {
      return '';
    }
    return Object.prototype.hasOwnProperty.call(PDF_TOOL_CONFIG, tool_key)
      ? tool_key
      : '';
  }

  UpdateRouteHistory(tool_key, history_mode) {
    const base_url = `${window.location.pathname}${window.location.search}`;
    const target_url = tool_key
      ? `${base_url}#${this.ConvertToolKeyToSlug(tool_key)}`
      : base_url;
    const current_url = `${base_url}${window.location.hash}`;
    if (history_mode === 'push' && target_url !== current_url) {
      window.history.pushState(null, '', target_url);
    } else if (history_mode === 'replace') {
      window.history.replaceState(null, '', target_url);
    }
    document.title = tool_key
      ? `${PDF_TOOL_CONFIG[tool_key].title} - PDF Tools`
      : HOME_DOCUMENT_TITLE;
  }

  RouteFromLocation(history_mode) {
    const tool_key = this.ReadToolFromHash();
    if (tool_key) {
      this.SelectTool(tool_key, history_mode);
      return;
    }
    this.ShowToolOverview(history_mode);
  }

  ShowToolOverview(history_mode = 'push') {
    this.StartFileStateGeneration();
    this.selected_tool = '';
    this.elements.tool_buttons.forEach(tool_button => {
      tool_button.classList.remove('active');
    });
    this.live_preview_scheduler.Cancel();
    this.compress_preview_scheduler.Cancel();
    this.HideCompressPreview();
    this.SetWorkspaceBusy('');
    this.UnmountAnnotateEditor();
    this.HideWorkspaceDropOverlay();
    document.body.dataset.appView = 'home';
    this.UpdateRouteHistory('', history_mode);
  }

  RenderToolOverview() {
    const groups_element = document.getElementById('tool-overview-groups');
    if (!groups_element) return;
    groups_element.replaceChildren();
    document
      .querySelectorAll('[data-tool-category-tab]')
      .forEach(category_tab => {
        const tool_category = category_tab.dataset.toolCategoryTab;
        const group_element = document.createElement('section');
        group_element.className = 'tool-overview-group';
        const heading_element = document.createElement('h3');
        heading_element.className = 'tool-overview-group-title';
        heading_element.textContent = category_tab.textContent.trim();
        const grid_element = document.createElement('div');
        grid_element.className = 'tool-overview-grid';
        document
          .querySelectorAll(
            `[data-pdf-tool][data-tool-category="${tool_category}"]`
          )
          .forEach(tool_button => {
            grid_element.appendChild(this.CreateToolOverviewCard(tool_button));
          });
        group_element.append(heading_element, grid_element);
        groups_element.appendChild(group_element);
      });
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  CreateToolOverviewCard(tool_button) {
    const tool_key = tool_button.dataset.pdfTool;
    const tool_config = PDF_TOOL_CONFIG[tool_key];
    const card_element = document.createElement('button');
    card_element.type = 'button';
    card_element.className = 'tool-overview-card';
    card_element.dataset.overviewTool = tool_key;
    const icon_element = document.createElement('i');
    icon_element.dataset.lucide =
      tool_button.querySelector('[data-lucide]')?.dataset.lucide || 'file';
    icon_element.setAttribute('aria-hidden', 'true');
    const title_element = document.createElement('span');
    title_element.className = 'tool-overview-card-title';
    title_element.textContent = tool_config.title;
    const description_element = document.createElement('span');
    description_element.className = 'tool-overview-card-description';
    description_element.textContent = tool_config.description;
    card_element.append(icon_element, title_element, description_element);
    card_element.addEventListener('click', () => {
      this.SelectTool(tool_key);
    });
    return card_element;
  }

  async SelectTool(selected_tool, history_mode = 'push') {
    if (!PDF_TOOL_CONFIG[selected_tool]) return;
    const previous_tool = this.selected_tool;
    const effective_history_mode =
      history_mode === 'push' && previous_tool ? 'replace' : history_mode;
    const tool_config = PDF_TOOL_CONFIG[selected_tool];
    this.StartFileStateGeneration();
    const preserved_files = this.GetFilesAcceptedByTool(
      this.uploaded_files,
      tool_config
    );
    const should_preserve_files = this.ShouldPreserveFilesForTool(
      this.uploaded_files,
      preserved_files,
      tool_config
    );
    this.selected_tool = selected_tool;
    this.uploaded_files = should_preserve_files ? preserved_files : [];
    this.page_operations = [];
    this.elements.tool_buttons.forEach(tool_button => {
      tool_button.classList.toggle(
        'active',
        tool_button.dataset.pdfTool === selected_tool
      );
    });
    document.body.dataset.appView = 'tool';
    this.UpdateRouteHistory(selected_tool, effective_history_mode);
    if (this.elements.tool_title) {
      this.elements.tool_title.textContent = tool_config.title;
    }
    if (this.elements.tool_description) {
      this.elements.tool_description.textContent = tool_config.description;
    }
    if (this.elements.workspace_drop_accept) {
      this.elements.workspace_drop_accept.textContent =
        this.FormatAcceptedFilesLabel(tool_config);
    }
    if (this.elements.file_input) {
      if (!should_preserve_files) {
        this.elements.file_input.value = '';
      }
      this.elements.file_input.multiple = tool_config.allows_multiple_files;
      this.elements.file_input.accept =
        tool_config.accepted_file_types.join(',');
    }
    this.elements.split_options?.classList.toggle(
      'hidden',
      selected_tool !== 'split' && selected_tool !== 'extract_images'
    );
    this.elements.organize_options?.classList.toggle(
      'hidden',
      selected_tool !== 'organize'
    );
    this.elements.merge_workspace?.classList.toggle(
      'hidden',
      selected_tool !== 'merge' && selected_tool !== 'images_to_pdf'
    );
    this.elements.split_workspace?.classList.toggle(
      'hidden',
      selected_tool !== 'split' && selected_tool !== 'extract_images'
    );
    this.elements.text_workspace?.classList.toggle(
      'hidden',
      selected_tool !== 'extract_text'
    );
    if (this.elements.split_range_help) {
      this.elements.split_range_help.textContent =
        SPLIT_RANGE_HELP_TEXTS[selected_tool] || '';
    }
    this.elements.watermark_options?.classList.toggle(
      'hidden',
      selected_tool !== 'watermark'
    );
    this.elements.page_number_options?.classList.toggle(
      'hidden',
      selected_tool !== 'page_numbers'
    );
    this.elements.annotate_options?.classList.toggle(
      'hidden',
      selected_tool !== 'annotate'
    );
    this.elements.compression_options?.classList.toggle(
      'hidden',
      selected_tool !== 'compress'
    );
    this.UpdateCompressionWarning();
    if (selected_tool !== 'annotate') {
      this.UnmountAnnotateEditor();
    }
    this.live_preview_scheduler.Cancel();
    this.compress_preview_scheduler.Cancel();
    this.HideCompressPreview();
    this.SetWorkspaceBusy('');
    this.SetLivePreviewHint('');
    this.HideCompressionInfo();
    this.SetErrorMessage('');
    if (should_preserve_files) {
      await this.RefreshUploadedFileState();
      return;
    }
    this.preview_pages = [];
    this.preview_current_page_index = 0;
    this.preview_module.RenderFileList([]);
    this.SetWorkspaceHasFiles();
    this.preview_module.RenderPageOperations([]);
    this.RenderFileOrderWorkspace();
    this.split_pages = [];
    this.split_selected_page_indexes = new Set();
    this.HandleSplitRangeInput();
    this.extracted_text_files = [];
    this.RenderTextWorkspace('อัปโหลด PDF เพื่อดึงข้อความ');
    this.preview_module.RenderPdfPreview(null);
    this.SetStatusMessage('เลือกไฟล์เพื่อเริ่มต้น');
    this.RenderOutputSummary();
  }

  GetFilesAcceptedByTool(uploaded_files, tool_config) {
    return (uploaded_files || []).filter(uploaded_file => {
      return tool_config.accepted_file_types.includes(uploaded_file.file_type);
    });
  }

  ShouldPreserveFilesForTool(uploaded_files, preserved_files, tool_config) {
    const accepted_file_count = (preserved_files || []).length;
    const current_file_count = (uploaded_files || []).length;
    if (
      accepted_file_count === 0 ||
      accepted_file_count !== current_file_count
    ) {
      return false;
    }
    return tool_config.allows_multiple_files || accepted_file_count === 1;
  }

  async HandleFileSelection(event) {
    await this.ReadSelectedFiles(event?.target?.files);
  }

  async HandleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    await this.ReadSelectedFiles(event?.dataTransfer?.files);
  }

  ResetWorkspaceDrag() {
    this.workspace_drag_depth = 0;
    this.HideWorkspaceDropOverlay();
  }

  IsFileDrag(event) {
    return Array.from(event?.dataTransfer?.types || []).includes('Files');
  }

  ShowWorkspaceDropOverlay() {
    if (this.elements.workspace_drop_overlay_text) {
      this.elements.workspace_drop_overlay_text.textContent =
        this.uploaded_files.length > 0
          ? 'วางเพื่อแทนที่ไฟล์เดิม'
          : 'วางเพื่อเลือกไฟล์';
    }
    const tool_tabs = this.elements.workspace?.querySelector('.tool-tabs');
    const overlay_top_px = tool_tabs
      ? tool_tabs.offsetTop + tool_tabs.offsetHeight + 8
      : 8;
    this.elements.workspace_drop_overlay?.style.setProperty(
      '--workspace-drop-overlay-top',
      `${overlay_top_px}px`
    );
    this.elements.workspace_drop_overlay?.classList.remove('hidden');
  }

  HideWorkspaceDropOverlay() {
    this.elements.workspace_drop_overlay?.classList.add('hidden');
  }

  SetWorkspaceHasFiles() {
    if (!this.elements.workspace) return;
    this.elements.workspace.dataset.hasFiles = String(
      this.uploaded_files.length > 0
    );
  }

  FormatAcceptedFilesLabel(tool_config) {
    const type_label =
      tool_config.accepted_file_types === IMAGE_FILE_TYPES
        ? 'รูปภาพ JPG, PNG, WebP'
        : 'PDF';
    const count_label = tool_config.allows_multiple_files
      ? 'หลายไฟล์'
      : '1 ไฟล์';
    return `รับไฟล์ ${type_label} ${count_label}`;
  }

  HandleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }

  async ReadSelectedFiles(file_list) {
    this.file_read_sequence += 1;
    const read_sequence = this.file_read_sequence;
    const started_tool = this.selected_tool;
    const tool_config = PDF_TOOL_CONFIG[started_tool];
    try {
      if (started_tool === 'compress') {
        const size_validation = this.file_module.ValidateMaximumFileSize(
          file_list,
          MAXIMUM_COMPRESSION_FILE_SIZE_BYTES,
          MAXIMUM_COMPRESSION_FILE_SIZE_LABEL
        );
        if (!size_validation.is_valid) {
          throw new Error(size_validation.error_message);
        }
      }
      const read_files = await this.file_module.ReadFiles(
        file_list,
        tool_config.accepted_file_types
      );
      if (
        this.file_read_sequence !== read_sequence ||
        this.selected_tool !== started_tool
      ) {
        return;
      }
      this.uploaded_files = read_files;
      this.HideCompressionInfo();
      await this.RefreshUploadedFileState();
    } catch (error) {
      this.SetErrorMessage(error.message);
    }
  }

  async MovePageOperation(operation_index, direction) {
    const next_index = operation_index + direction;
    if (next_index < 0 || next_index >= this.page_operations.length) return;
    const next_page_operations = [...this.page_operations];
    const [moved_operation] = next_page_operations.splice(operation_index, 1);
    next_page_operations.splice(next_index, 0, moved_operation);
    this.page_operations = next_page_operations;
    this.preview_module.RenderPageOperations(this.page_operations);
    this.RenderOutputSummary();
    this.SyncPreviewPagesFromPageOperations(moved_operation.operation_id);
    await this.RenderCurrentPreviewPage();
  }

  async RotatePageOperation(operation_index) {
    let rotated_operation_id = '';
    this.page_operations = this.page_operations.map(
      (page_operation, current_index) => {
        if (current_index !== operation_index) return page_operation;
        rotated_operation_id = page_operation.operation_id;
        return {
          ...page_operation,
          rotation_degrees: (page_operation.rotation_degrees + 90) % 360
        };
      }
    );
    this.preview_module.RenderPageOperations(this.page_operations);
    this.RenderOutputSummary();
    this.SyncPreviewPagesFromPageOperations(rotated_operation_id);
    await this.RenderCurrentPreviewPage();
  }

  async DeletePageOperation(operation_index) {
    let deleted_operation_id = '';
    this.page_operations = this.page_operations.map(
      (page_operation, current_index) => {
        if (current_index !== operation_index) return page_operation;
        deleted_operation_id = page_operation.operation_id;
        return {
          ...page_operation,
          is_deleted: !page_operation.is_deleted
        };
      }
    );
    this.preview_module.RenderPageOperations(this.page_operations);
    this.RenderOutputSummary();
    this.SyncPreviewPagesFromPageOperations(deleted_operation_id);
    await this.RenderCurrentPreviewPage();
  }

  async PreviewPageOperation(operation_index) {
    const selected_operation = this.page_operations[operation_index];
    if (!selected_operation || selected_operation.is_deleted) return;
    const preview_page_index = this.preview_pages.findIndex(preview_page => {
      return preview_page.operation_id === selected_operation.operation_id;
    });
    if (preview_page_index < 0) return;
    this.preview_current_page_index = preview_page_index;
    await this.RenderCurrentPreviewPage();
  }

  async AttachMergeFileDetails(uploaded_files) {
    const detailed_files = [];
    for (const uploaded_file of uploaded_files) {
      if (uploaded_file.thumbnail_data_url !== undefined) {
        detailed_files.push(uploaded_file);
        continue;
      }
      let thumbnail_data_url = '';
      let page_count = 0;
      try {
        const pdf_document =
          await this.render_module.LoadPdfDocument(uploaded_file);
        page_count = pdf_document.numPages;
        thumbnail_data_url = await this.render_module.RenderPageThumbnail(
          pdf_document,
          0
        );
      } catch (error) {
        thumbnail_data_url = '';
      }
      detailed_files.push({ ...uploaded_file, thumbnail_data_url, page_count });
    }
    return detailed_files;
  }

  async AttachImageFileDetails(uploaded_files) {
    const detailed_files = [];
    for (const uploaded_file of uploaded_files) {
      if (uploaded_file.thumbnail_data_url !== undefined) {
        detailed_files.push(uploaded_file);
        continue;
      }
      let thumbnail_data_url = '';
      let width_px = 0;
      let height_px = 0;
      try {
        const image_thumbnail = await this.render_module.RenderImageToDataUrl(
          uploaded_file,
          PDF_THUMBNAIL_WIDTH
        );
        thumbnail_data_url = image_thumbnail.data_url;
        width_px = image_thumbnail.width_px;
        height_px = image_thumbnail.height_px;
      } catch (error) {
        thumbnail_data_url = '';
      }
      detailed_files.push({
        ...uploaded_file,
        thumbnail_data_url,
        width_px,
        height_px
      });
    }
    return detailed_files;
  }

  RenderFileOrderWorkspace() {
    if (this.selected_tool === 'merge') {
      this.preview_module.RenderMergeFiles(this.uploaded_files);
      return;
    }
    if (this.selected_tool === 'images_to_pdf') {
      this.preview_module.RenderMergeFiles(
        this.uploaded_files,
        'อัปโหลดรูปภาพเพื่อเรียงลำดับ'
      );
      return;
    }
    this.preview_module.RenderMergeFiles([]);
  }

  async MoveUploadedFile(file_index, direction) {
    const next_index = file_index + direction;
    if (next_index < 0 || next_index >= this.uploaded_files.length) return;
    const next_uploaded_files = [...this.uploaded_files];
    const [moved_file] = next_uploaded_files.splice(file_index, 1);
    next_uploaded_files.splice(next_index, 0, moved_file);
    this.uploaded_files = next_uploaded_files;
    await this.RefreshUploadedFileState();
  }

  async RemoveUploadedFile(file_index) {
    if (file_index < 0 || file_index >= this.uploaded_files.length) return;
    this.uploaded_files = this.uploaded_files.filter(
      (uploaded_file, current_index) => current_index !== file_index
    );
    if (this.uploaded_files.length > 0) {
      await this.RefreshUploadedFileState();
      return;
    }
    this.StartFileStateGeneration();
    this.preview_pages = [];
    this.preview_current_page_index = 0;
    if (this.elements.file_input) {
      this.elements.file_input.value = '';
    }
    this.preview_module.RenderFileList([]);
    this.SetWorkspaceHasFiles();
    this.RenderFileOrderWorkspace();
    this.preview_module.RenderPdfPreview(null);
    this.SetStatusMessage('เลือกไฟล์เพื่อเริ่มต้น');
    this.RenderOutputSummary();
  }

  async PreviewUploadedFile(file_index) {
    const uploaded_file = this.uploaded_files[file_index];
    if (!uploaded_file) return;
    const preview_page_index = this.preview_pages.findIndex(
      preview_page => preview_page.file_bytes === uploaded_file.file_bytes
    );
    if (preview_page_index < 0) return;
    this.preview_current_page_index = preview_page_index;
    await this.RenderCurrentPreviewPage();
  }

  HandleSplitRangeInput() {
    const range_text = String(
      this.elements.split_range_input?.value || ''
    ).trim();
    if (this.split_pages.length === 0 || !range_text) {
      this.split_selected_page_indexes = new Set();
      this.SetSplitRangeHint('');
      this.RenderSplitWorkspace();
      return;
    }
    try {
      this.split_selected_page_indexes = new Set(
        this.operation_module.ParsePageRange(
          range_text,
          this.split_pages.length
        )
      );
      this.SetSplitRangeHint('');
    } catch (error) {
      this.SetSplitRangeHint(error.message);
    }
    this.RenderSplitWorkspace();
  }

  ToggleSplitPage(page_index) {
    if (page_index < 0 || page_index >= this.split_pages.length) return;
    const next_selected_page_indexes = new Set(
      this.split_selected_page_indexes
    );
    if (next_selected_page_indexes.has(page_index)) {
      next_selected_page_indexes.delete(page_index);
    } else {
      next_selected_page_indexes.add(page_index);
    }
    this.split_selected_page_indexes = next_selected_page_indexes;
    if (this.elements.split_range_input) {
      this.elements.split_range_input.value =
        this.operation_module.FormatPageRange(next_selected_page_indexes);
    }
    this.SetSplitRangeHint('');
    this.RenderSplitWorkspace();
  }

  async PreviewSplitPage(page_index) {
    const split_page = this.split_pages[page_index];
    if (!split_page) return;
    const preview_page_index = this.preview_pages.findIndex(
      preview_page =>
        preview_page.file_bytes === split_page.file_bytes &&
        preview_page.source_page_index === split_page.source_page_index
    );
    if (preview_page_index < 0) return;
    this.preview_current_page_index = preview_page_index;
    await this.RenderCurrentPreviewPage();
  }

  SetSplitRangeHint(hint_text) {
    if (this.elements.split_range_hint) {
      this.elements.split_range_hint.textContent = hint_text;
    }
  }

  RenderSplitWorkspace() {
    this.preview_module.RenderSplitPages(
      this.split_pages,
      this.split_selected_page_indexes
    );
  }

  async PreviewPreviousPage() {
    if (this.preview_current_page_index <= 0) return;
    this.preview_current_page_index -= 1;
    await this.RenderCurrentPreviewPage();
  }

  async PreviewNextPage() {
    if (this.preview_current_page_index >= this.preview_pages.length - 1)
      return;
    this.preview_current_page_index += 1;
    await this.RenderCurrentPreviewPage();
  }

  async ProcessSelectedTool() {
    if (this.uploaded_files.length === 0) {
      this.SetErrorMessage('กรุณาอัปโหลดไฟล์ก่อน');
      return;
    }
    const tool_config = PDF_TOOL_CONFIG[this.selected_tool];
    this.SetProcessingStatus('processing');
    try {
      let output_bytes = null;
      if (this.selected_tool === 'merge') {
        output_bytes = await this.operation_module.MergePdfFiles(
          this.uploaded_files
        );
      } else if (this.selected_tool === 'split') {
        output_bytes = await this.operation_module.SplitPdfFile(
          this.uploaded_files[0],
          this.elements.split_range_input?.value
        );
      } else if (this.selected_tool === 'organize') {
        output_bytes = await this.operation_module.ExportPageOperations(
          this.page_operations
        );
      } else if (this.selected_tool === 'images_to_pdf') {
        output_bytes = await this.operation_module.CreatePdfFromImages(
          this.uploaded_files
        );
      } else if (this.selected_tool === 'extract_text') {
        const text_content = this.HasExtractedText()
          ? this.text_module.FormatExtractedText(this.extracted_text_files)
          : await this.text_module.ExtractTextFromFiles(this.uploaded_files);
        this.download_module.DownloadText(
          text_content,
          tool_config.output_file_name
        );
        this.CompleteProcessing('ดึงข้อความสำเร็จ');
        return;
      } else if (this.selected_tool === 'extract_images') {
        this.SetStatusMessage('กำลังแปลงหน้า PDF เป็นภาพ...');
        const page_indexes = this.operation_module.ParsePageRange(
          this.elements.split_range_input?.value,
          this.split_pages.length
        );
        const image_files = await this.render_module.RenderPagesAsImages(
          this.uploaded_files[0],
          page_indexes
        );
        await this.download_module.DownloadZipFiles(
          image_files,
          tool_config.output_file_name
        );
        this.CompleteProcessing(`สร้างภาพ ${image_files.length} ไฟล์สำเร็จ`);
        return;
      } else if (this.selected_tool === 'compress') {
        const compression_result = await this.operation_module.CompressPdfFile(
          this.uploaded_files[0],
          this.GetCompressionOptions(),
          progress_state => {
            this.SetStatusMessage(
              `กำลังบีบอัดหน้า ${progress_state.current_page} จาก ${progress_state.page_count}`
            );
          }
        );
        this.RenderCompressionInfo(compression_result);
        this.download_module.DownloadBytes(
          compression_result.file_bytes,
          tool_config.output_file_name
        );
        this.CompleteProcessing(
          compression_result.used_original_file
            ? 'เอกสารนี้ลดขนาดเพิ่มเติมไม่ได้ จึงดาวน์โหลดไฟล์ต้นฉบับ'
            : 'บีบอัด PDF สำเร็จ'
        );
        return;
      } else if (this.selected_tool === 'watermark') {
        output_bytes = await this.operation_module.AddWatermarkToPdf(
          this.uploaded_files[0],
          this.GetWatermarkOptions()
        );
      } else if (this.selected_tool === 'page_numbers') {
        output_bytes = await this.operation_module.AddPageNumbersToPdf(
          this.uploaded_files[0],
          this.GetPageNumberOptions()
        );
      } else if (this.selected_tool === 'annotate') {
        output_bytes = await this.annotation_export.Apply(
          this.uploaded_files[0].file_bytes,
          this.annotation_store.GetAllPages()
        );
      }
      this.download_module.DownloadBytes(
        output_bytes,
        tool_config.output_file_name
      );
      const export_warnings =
        this.selected_tool === 'annotate'
          ? this.annotation_export.GetWarnings()
          : [];
      this.CompleteProcessing(
        export_warnings.length > 0
          ? `สร้างไฟล์ PDF สำเร็จ (${export_warnings.join(', ')})`
          : 'สร้างไฟล์ PDF สำเร็จ'
      );
    } catch (error) {
      this.SetErrorMessage(error.message);
    } finally {
      this.SetProcessingStatus('idle');
    }
  }

  SetProcessingStatus(processing_status) {
    this.processing_status = processing_status;
    const process_button = this.elements.process_button;
    if (!process_button) return;
    const is_processing = processing_status === 'processing';
    process_button.disabled = is_processing;
    if (is_processing) {
      process_button.setAttribute('aria-busy', 'true');
    } else {
      process_button.removeAttribute('aria-busy');
    }
    const icon_element = document.createElement('i');
    icon_element.dataset.lucide = is_processing ? 'loader-circle' : 'download';
    icon_element.className = is_processing ? 'icon-18 spin-icon' : 'icon-18';
    const label_element = document.createElement('span');
    label_element.textContent = is_processing
      ? 'กำลังประมวลผล...'
      : 'สร้างและดาวน์โหลด';
    process_button.replaceChildren(icon_element, label_element);
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  SetStatusMessage(status_message) {
    if (this.elements.status_message) {
      this.elements.status_message.textContent = status_message;
    }
  }

  SetErrorMessage(error_message) {
    this.error_message = error_message;
    if (this.elements.error_message) {
      this.elements.error_message.textContent = error_message;
      this.elements.error_message.classList.toggle('hidden', !error_message);
    }
    if (error_message) {
      this.toast_module.ShowError(error_message);
    }
  }

  CompleteProcessing(success_message) {
    this.SetErrorMessage('');
    this.SetStatusMessage(success_message);
    this.toast_module.ShowSuccess(success_message);
  }

  SetWorkspaceBusy(busy_message) {
    const workspace_element = this.elements.workspace;
    if (!workspace_element) return;
    const is_busy = Boolean(busy_message);
    if (is_busy) {
      workspace_element.setAttribute('aria-busy', 'true');
      workspace_element.dataset.busyMessage = busy_message;
    } else {
      workspace_element.removeAttribute('aria-busy');
      delete workspace_element.dataset.busyMessage;
    }
    if (this.elements.workspace_busy_text) {
      this.elements.workspace_busy_text.textContent = busy_message || '';
    }
    this.elements.workspace_busy_indicator?.classList.toggle(
      'hidden',
      !is_busy
    );
  }

  RenderCompressionInfo(compression_result) {
    if (!this.elements.compression_info) return;
    this.elements.compression_info.classList.remove('hidden');
    this.elements.compression_original_size.textContent =
      this.file_module.FormatFileSize(compression_result.original_size_bytes);
    this.elements.compression_compressed_size.textContent =
      this.file_module.FormatFileSize(compression_result.compressed_size_bytes);
    this.elements.compression_reduction.textContent = `${compression_result.reduction_percent.toFixed(1)}%`;
    if (this.elements.compression_level_result) {
      this.elements.compression_level_result.textContent =
        COMPRESSION_LEVEL_LABELS[compression_result.compression_level];
    }
  }

  GetCompressionOptions() {
    const selected_input = Array.from(
      this.elements.compression_level_inputs || []
    ).find(compression_level_input => compression_level_input.checked);
    return {
      compression_level: selected_input?.value || 'medium'
    };
  }

  UpdateCompressionWarning() {
    const compression_level = this.GetCompressionOptions().compression_level;
    this.elements.compression_warning?.classList.toggle(
      'hidden',
      compression_level === 'low'
    );
  }

  GetWatermarkOptions() {
    return {
      text: this.elements.watermark_text?.value,
      size: this.elements.watermark_size?.value,
      opacity_percent: this.elements.watermark_opacity?.value,
      rotation_degrees: this.elements.watermark_rotation?.value,
      position: this.elements.watermark_position?.value,
      color: this.elements.watermark_color?.value,
      offset_x: this.elements.watermark_offset_x?.value,
      offset_y: this.elements.watermark_offset_y?.value,
      is_pattern_enabled: this.elements.watermark_pattern?.checked,
      gap_x: this.elements.watermark_gap_x?.value,
      gap_y: this.elements.watermark_gap_y?.value,
      page_range: this.elements.watermark_page_range?.value
    };
  }

  UpdateWatermarkPatternGapVisibility() {
    this.elements.watermark_pattern_gap_options?.classList.toggle(
      'hidden',
      !this.elements.watermark_pattern?.checked
    );
  }

  GetPageNumberOptions() {
    return {
      format: this.elements.page_number_format?.value,
      position: this.elements.page_number_position?.value,
      start_number: this.elements.page_number_start?.value,
      page_range: this.elements.page_number_range?.value
    };
  }

  HideCompressionInfo() {
    this.elements.compression_info?.classList.add('hidden');
    if (this.elements.compression_original_size) {
      this.elements.compression_original_size.textContent = '-';
    }
    if (this.elements.compression_compressed_size) {
      this.elements.compression_compressed_size.textContent = '-';
    }
    if (this.elements.compression_reduction) {
      this.elements.compression_reduction.textContent = '-';
    }
    if (this.elements.compression_level_result) {
      this.elements.compression_level_result.textContent = '-';
    }
  }

  BuildOutputSummary() {
    const tool_config = PDF_TOOL_CONFIG[this.selected_tool];
    const uploaded_files = this.uploaded_files || [];
    const page_operations = this.page_operations || [];
    const is_organize_tool = this.selected_tool === 'organize';
    let source_page_count = (this.preview_pages || []).length;
    if (is_organize_tool) {
      source_page_count = page_operations.length;
    } else if (this.selected_tool === 'images_to_pdf') {
      source_page_count = uploaded_files.length;
    }
    return {
      output_file_name: tool_config ? tool_config.output_file_name : '',
      source_file_count: uploaded_files.length,
      source_size_bytes: uploaded_files.reduce(
        (total_bytes, uploaded_file) =>
          total_bytes + (uploaded_file.file_size_bytes || 0),
        0
      ),
      source_page_count: source_page_count,
      export_page_count: is_organize_tool
        ? page_operations.filter(page_operation => !page_operation.is_deleted)
            .length
        : null
    };
  }

  RenderOutputSummary() {
    this.output_summary_module.Render(this.BuildOutputSummary());
  }

  ShowDependencyWarnings() {
    if (typeof PDFLib === 'undefined') {
      this.SetErrorMessage(
        'ไม่สามารถโหลด pdf-lib ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
  }

  StartFileStateGeneration() {
    this.file_state_generation += 1;
    return this.file_state_generation;
  }

  IsCurrentFileStateGeneration(generation) {
    return generation === this.file_state_generation;
  }

  async RefreshUploadedFileState() {
    const generation = this.StartFileStateGeneration();
    this.SetWorkspaceBusy('กำลังเตรียมไฟล์...');
    try {
      await this.LoadUploadedFileState(generation);
    } finally {
      if (this.IsCurrentFileStateGeneration(generation)) {
        this.SetWorkspaceBusy('');
      }
    }
  }

  async LoadUploadedFileState(generation) {
    const IsCurrent = () => this.IsCurrentFileStateGeneration(generation);
    this.preview_module.RenderFileList(this.uploaded_files);
    this.SetWorkspaceHasFiles();
    this.preview_current_page_index = 0;
    if (this.selected_tool === 'annotate') {
      this.annotation_store.Reset();
      this.RenderAnnotateInspector(null);
    }
    if (this.selected_tool === 'organize') {
      this.SetStatusMessage('กำลังสร้างรายการหน้า...');
      const page_operations = await this.operation_module.CreatePageOperations(
        this.uploaded_files
      );
      if (!IsCurrent()) return;
      this.SetStatusMessage('กำลังสร้าง thumbnail...');
      const page_operations_with_thumbnails =
        await this.render_module.AttachThumbnails(page_operations);
      if (!IsCurrent()) return;
      this.page_operations = page_operations_with_thumbnails;
      this.preview_module.RenderPageOperations(this.page_operations);
      this.SyncPreviewPagesFromPageOperations();
    } else {
      this.page_operations = [];
      this.preview_module.RenderPageOperations([]);
      await this.LoadPreviewPagesFromUploadedFiles(IsCurrent);
      if (!IsCurrent()) return;
    }
    if (this.selected_tool === 'merge') {
      const detailed_files = await this.AttachMergeFileDetails(
        this.uploaded_files
      );
      if (!IsCurrent()) return;
      this.uploaded_files = detailed_files;
    } else if (this.selected_tool === 'images_to_pdf') {
      const detailed_files = await this.AttachImageFileDetails(
        this.uploaded_files
      );
      if (!IsCurrent()) return;
      this.uploaded_files = detailed_files;
    }
    this.RenderFileOrderWorkspace();
    const uses_page_selection =
      this.selected_tool === 'split' || this.selected_tool === 'extract_images';
    let split_pages = [];
    if (uses_page_selection) {
      const split_page_operations =
        await this.operation_module.CreatePageOperations(this.uploaded_files);
      if (!IsCurrent()) return;
      split_pages = await this.render_module.AttachThumbnails(
        split_page_operations
      );
      if (!IsCurrent()) return;
    }
    this.split_pages = split_pages;
    if (
      this.selected_tool === 'extract_images' &&
      this.elements.split_range_input
    ) {
      this.elements.split_range_input.value =
        this.operation_module.FormatPageRange(
          this.split_pages.map((split_page, page_index) => page_index)
        );
    }
    this.split_selected_page_indexes = new Set();
    this.HandleSplitRangeInput();
    await this.LoadExtractedText(IsCurrent);
    if (!IsCurrent()) return;
    await this.RenderCurrentPreviewPage(IsCurrent);
    if (!IsCurrent()) return;
    this.SetErrorMessage('');
    this.SetStatusMessage(`เลือกแล้ว ${this.uploaded_files.length} ไฟล์`);
    this.RenderOutputSummary();
    this.ScheduleLivePreview();
  }

  async LoadPreviewPagesFromUploadedFiles(should_continue = () => true) {
    const preview_pages = [];
    for (const uploaded_file of this.uploaded_files) {
      if (IMAGE_FILE_TYPES.includes(uploaded_file.file_type)) {
        preview_pages.push({
          is_image: true,
          file_name: uploaded_file.file_name,
          file_type: uploaded_file.file_type,
          file_bytes: uploaded_file.file_bytes,
          source_page_index: 0,
          page_number: 1,
          file_page_count: 1,
          rotation_degrees: 0
        });
        continue;
      }
      if (uploaded_file.file_type !== PDF_FILE_TYPE) {
        continue;
      }
      const pdf_document =
        await this.render_module.LoadPdfDocument(uploaded_file);
      if (!should_continue()) return;
      for (
        let source_page_index = 0;
        source_page_index < pdf_document.numPages;
        source_page_index += 1
      ) {
        preview_pages.push({
          file_name: uploaded_file.file_name,
          file_bytes: uploaded_file.file_bytes,
          source_page_index: source_page_index,
          page_number: source_page_index + 1,
          file_page_count: pdf_document.numPages,
          rotation_degrees: 0
        });
      }
    }
    if (!should_continue()) return;
    this.preview_pages = preview_pages;
  }

  SyncPreviewPagesFromPageOperations(preferred_operation_id = '') {
    this.preview_pages = (this.page_operations || [])
      .filter(page_operation => !page_operation.is_deleted)
      .map(page_operation => {
        return {
          operation_id: page_operation.operation_id,
          file_name: page_operation.file_name,
          file_bytes: page_operation.file_bytes,
          source_page_index: page_operation.source_page_index,
          page_number: page_operation.display_page_number,
          file_page_count:
            page_operation.file_page_count ||
            page_operation.display_page_number,
          rotation_degrees: page_operation.rotation_degrees
        };
      });

    if (preferred_operation_id) {
      const preferred_page_index = this.preview_pages.findIndex(
        preview_page => preview_page.operation_id === preferred_operation_id
      );
      if (preferred_page_index >= 0) {
        this.preview_current_page_index = preferred_page_index;
        return;
      }
    }

    this.preview_current_page_index = Math.min(
      this.preview_current_page_index,
      Math.max(this.preview_pages.length - 1, 0)
    );
  }

  async LoadExtractedText(should_continue = () => true) {
    this.extracted_text_files = [];
    if (this.selected_tool !== 'extract_text') {
      this.RenderTextWorkspace('อัปโหลด PDF เพื่อดึงข้อความ');
      return;
    }
    try {
      const extracted_text_files = await this.text_module.ExtractTextPages(
        this.uploaded_files
      );
      if (!should_continue()) return;
      this.extracted_text_files = extracted_text_files;
    } catch (error) {
      if (!should_continue()) return;
      this.extracted_text_files = [];
      this.RenderTextWorkspace('ไม่พบข้อความใน PDF นี้');
      this.SetErrorMessage(error.message);
      return;
    }
    this.RenderTextWorkspace('ไม่พบข้อความใน PDF นี้');
    if (!this.HasExtractedText()) {
      this.SetErrorMessage('ไม่พบข้อความใน PDF นี้');
    }
  }

  HasExtractedText() {
    return this.extracted_text_files.some(
      text_file => text_file.pages.length > 0
    );
  }

  RenderTextWorkspace(empty_state_text) {
    this.preview_module.RenderExtractedText(
      this.extracted_text_files,
      empty_state_text
    );
    if (this.elements.copy_text_button) {
      this.elements.copy_text_button.disabled = !this.HasExtractedText();
    }
  }

  async CopyExtractedText() {
    if (!this.HasExtractedText()) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(
        this.text_module.FormatExtractedText(this.extracted_text_files)
      );
      this.toast_module.ShowSuccess('คัดลอกข้อความแล้ว');
    } catch (error) {
      this.toast_module.ShowError(
        'คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกเอง'
      );
    }
  }

  ScheduleCompressPreview() {
    if (this.selected_tool !== 'compress' || this.uploaded_files.length !== 1)
      return;
    if (this.preview_pages.length === 0) return;
    this.compress_preview_scheduler.Schedule();
  }

  async RenderCompressPreview(request_id) {
    const preview_page = this.preview_pages[this.preview_current_page_index];
    if (!preview_page) return;
    this.SetWorkspaceBusy('กำลังสร้างตัวอย่างการบีบอัด...');
    let pdf_document = null;
    try {
      const compression_options =
        this.operation_module.NormalizeCompressionOptions(
          this.GetCompressionOptions()
        );
      if (!compression_options.should_rasterize) {
        if (this.compress_preview_scheduler.IsLatest(request_id)) {
          this.ShowCompressPreview(
            '',
            'ระดับต่ำไม่เปลี่ยนภาพ ขนาดจริงจะทราบหลังส่งออก',
            ''
          );
        }
        return;
      }
      pdf_document = await this.render_module.LoadPdfDocument({
        file_bytes: preview_page.file_bytes
      });
      const rendered_page = await this.render_module.RenderPageAsJpeg(
        pdf_document,
        preview_page.source_page_index + 1,
        compression_options
      );
      if (!this.compress_preview_scheduler.IsLatest(request_id)) return;
      const preview_url = URL.createObjectURL(
        new Blob([rendered_page.image_bytes], { type: 'image/jpeg' })
      );
      const level_label =
        COMPRESSION_LEVEL_LABELS[compression_options.compression_level];
      const page_size_label = this.file_module.FormatFileSize(
        rendered_page.image_bytes.byteLength
      );
      const original_average_bytes =
        (this.uploaded_files[0]?.file_size_bytes || 0) /
        this.preview_pages.length;
      const warning_text =
        rendered_page.image_bytes.byteLength > original_average_bytes
          ? 'อาจใหญ่กว่าไฟล์เดิม แนะนำระดับต่ำ'
          : '';
      this.ShowCompressPreview(
        preview_url,
        `หลังบีบอัด • ระดับ${level_label} • ≈ ${page_size_label} ต่อหน้า`,
        `ตัวอย่างหลังบีบอัด หน้า ${preview_page.page_number}`,
        warning_text
      );
    } catch (error) {
      if (this.compress_preview_scheduler.IsLatest(request_id)) {
        this.ShowCompressPreview('', error.message, '');
      }
    } finally {
      if (pdf_document) {
        pdf_document.loadingTask.destroy();
      }
      if (this.compress_preview_scheduler.IsLatest(request_id)) {
        this.SetWorkspaceBusy('');
      }
    }
  }

  FormatOriginalPageSizeCaption() {
    if (this.preview_pages.length === 0) return '';
    const original_average_bytes =
      (this.uploaded_files[0]?.file_size_bytes || 0) /
      this.preview_pages.length;
    return `ต้นฉบับ • ≈ ${this.file_module.FormatFileSize(original_average_bytes)} ต่อหน้า`;
  }

  ShowCompressPreview(image_url, caption_text, alt_text, warning_text = '') {
    this.ReleaseCompressPreviewUrl();
    this.compress_preview_url = image_url;
    const image_element = this.elements.compress_compare_image;
    if (image_element) {
      if (image_url) {
        image_element.src = image_url;
        image_element.alt = alt_text;
      } else {
        image_element.removeAttribute('src');
        image_element.alt = '';
      }
      image_element.classList.toggle('hidden', !image_url);
    }
    if (this.elements.compress_compare_caption) {
      this.elements.compress_compare_caption.textContent = caption_text;
    }
    if (this.elements.compress_original_caption) {
      const original_caption_text = this.FormatOriginalPageSizeCaption();
      this.elements.compress_original_caption.textContent =
        original_caption_text;
      this.elements.compress_original_caption.classList.toggle(
        'hidden',
        !original_caption_text
      );
    }
    this.SetCompressWarning(warning_text);
    this.elements.compress_compare_figure?.classList.remove('hidden');
  }

  SetCompressWarning(warning_text) {
    const warning_element = this.elements.compress_compare_warning;
    if (!warning_element) return;
    warning_element.textContent = warning_text;
    warning_element.classList.toggle('hidden', !warning_text);
  }

  HideCompressPreview() {
    this.ReleaseCompressPreviewUrl();
    const image_element = this.elements.compress_compare_image;
    if (image_element) {
      image_element.removeAttribute('src');
      image_element.alt = '';
      image_element.classList.add('hidden');
    }
    if (this.elements.compress_compare_caption) {
      this.elements.compress_compare_caption.textContent = '';
    }
    if (this.elements.compress_original_caption) {
      this.elements.compress_original_caption.textContent = '';
      this.elements.compress_original_caption.classList.add('hidden');
    }
    this.SetCompressWarning('');
    this.elements.compress_compare_figure?.classList.add('hidden');
  }

  ReleaseCompressPreviewUrl() {
    if (!this.compress_preview_url) return;
    URL.revokeObjectURL(this.compress_preview_url);
    this.compress_preview_url = '';
  }

  ScheduleLivePreview() {
    const is_live_preview_tool =
      this.selected_tool === 'watermark' ||
      this.selected_tool === 'page_numbers';
    if (!is_live_preview_tool || this.uploaded_files.length !== 1) return;
    this.live_preview_scheduler.Schedule();
  }

  async CreateLivePreviewBytes() {
    if (this.selected_tool === 'watermark') {
      return this.operation_module.AddWatermarkToPdf(
        this.uploaded_files[0],
        this.GetWatermarkOptions()
      );
    }
    return this.operation_module.AddPageNumbersToPdf(
      this.uploaded_files[0],
      this.GetPageNumberOptions()
    );
  }

  async RenderLivePreview(request_id) {
    this.SetWorkspaceBusy('กำลังสร้างตัวอย่าง...');
    try {
      const preview_bytes = await this.CreateLivePreviewBytes();
      if (!this.live_preview_scheduler.IsLatest(request_id)) return;
      this.preview_pages = this.preview_pages.map(preview_page => ({
        ...preview_page,
        file_bytes: preview_bytes,
        meta_suffix: 'ตัวอย่างผลลัพธ์'
      }));
      await this.RenderCurrentPreviewPage();
      if (!this.live_preview_scheduler.IsLatest(request_id)) return;
      this.SetLivePreviewHint('');
    } catch (error) {
      if (this.live_preview_scheduler.IsLatest(request_id)) {
        this.SetLivePreviewHint(error.message);
      }
    } finally {
      if (this.live_preview_scheduler.IsLatest(request_id)) {
        this.SetWorkspaceBusy('');
      }
    }
  }

  SetLivePreviewHint(hint_text) {
    if (this.elements.live_preview_hint) {
      this.elements.live_preview_hint.textContent = hint_text;
    }
  }

  async RenderImagePreviewPage(preview_page, should_continue = () => true) {
    try {
      const image_preview = await this.render_module.RenderImageToDataUrl(
        preview_page,
        PDF_PREVIEW_WIDTH
      );
      if (!should_continue()) return;
      this.preview_module.RenderPdfPreview({
        thumbnail_data_url: image_preview.data_url,
        file_name: preview_page.file_name,
        page_number: preview_page.page_number,
        file_page_count: preview_page.file_page_count,
        preview_page_number: this.preview_current_page_index + 1,
        preview_page_count: this.preview_pages.length,
        rotation_degrees: preview_page.rotation_degrees
      });
    } catch (error) {
      if (!should_continue()) return;
      this.preview_module.RenderPdfPreview(null);
      this.SetErrorMessage(error.message);
    }
  }

  async RenderCurrentPreviewPage(should_continue = () => true) {
    this.preview_render_sequence += 1;
    const render_sequence = this.preview_render_sequence;
    const IsRenderCurrent = () =>
      should_continue() && render_sequence === this.preview_render_sequence;
    if (this.preview_pages.length === 0) {
      this.preview_module.RenderPdfPreview(null);
      return;
    }

    this.preview_current_page_index = Math.min(
      Math.max(this.preview_current_page_index, 0),
      this.preview_pages.length - 1
    );
    const preview_page = this.preview_pages[this.preview_current_page_index];
    if (preview_page.is_image) {
      await this.RenderImagePreviewPage(preview_page, IsRenderCurrent);
      return;
    }
    const pdf_document = await this.render_module.LoadPdfDocument({
      file_bytes: preview_page.file_bytes
    });
    if (!IsRenderCurrent()) return;
    const thumbnail_data_url = await this.render_module.RenderPagePreview(
      pdf_document,
      preview_page.source_page_index
    );
    if (!IsRenderCurrent()) return;
    this.preview_module.RenderPdfPreview({
      thumbnail_data_url: thumbnail_data_url,
      file_name: preview_page.file_name,
      page_number: preview_page.page_number,
      file_page_count: preview_page.file_page_count,
      preview_page_number: this.preview_current_page_index + 1,
      preview_page_count: this.preview_pages.length,
      rotation_degrees: preview_page.rotation_degrees,
      meta_suffix: preview_page.meta_suffix
    });
    if (this.selected_tool === 'annotate') {
      this.MountAnnotateEditor();
      const annotate_page = await pdf_document.getPage(
        preview_page.source_page_index + 1
      );
      if (!IsRenderCurrent()) return;
      const annotate_viewport = annotate_page.getViewport({ scale: 1 });
      this.annotation_editor.SetPageHeightPt(annotate_viewport.height);
      this.annotation_editor.SetPage(preview_page.source_page_index);
      this.SyncOverlayToImage();
    }
    if (this.selected_tool === 'compress') {
      this.ScheduleCompressPreview();
    }
  }

  HandleAnnotateImage(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.SetErrorMessage('รองรับเฉพาะรูป PNG หรือ JPG');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const ratio = image.naturalWidth / image.naturalHeight || 1;
        this.annotation_editor.CreateElement('image', {
          image_data_url: reader.result,
          natural_ratio: ratio
        });
      };
      image.onerror = () => {
        this.SetErrorMessage(
          'ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกไฟล์ PNG หรือ JPG อื่น'
        );
      };
      image.src = reader.result;
    };
    reader.onerror = () => {
      this.SetErrorMessage('ไม่สามารถอ่านไฟล์รูปภาพได้');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  MountAnnotateEditor() {
    if (this.is_annotate_mounted) return;
    if (!this.elements.annotate_overlay) return;
    this.elements.annotate_overlay.classList.remove('hidden');
    this.annotation_editor.Mount(this.elements.annotate_overlay);
    this.is_annotate_mounted = true;
  }

  UnmountAnnotateEditor() {
    if (!this.is_annotate_mounted) return;
    this.annotation_editor.Unmount();
    this.elements.annotate_overlay?.classList.add('hidden');
    this.is_annotate_mounted = false;
  }

  UpdateTextPlacementButton(is_placing) {
    const add_text_button = document.getElementById('annotate-add-text');
    if (!add_text_button) return;
    add_text_button.classList.toggle('active', is_placing);
    add_text_button.setAttribute('aria-pressed', String(is_placing));
  }

  SyncOverlayToImage() {
    const image = this.elements.preview_image;
    const overlay = this.elements.annotate_overlay;
    if (!image || !overlay) return;
    if (
      this.selected_tool !== 'annotate' ||
      image.classList.contains('hidden')
    ) {
      return;
    }
    const frame = image.parentElement;
    if (!frame) return;
    const frame_rect = frame.getBoundingClientRect();
    const image_rect = image.getBoundingClientRect();
    overlay.style.left = `${image_rect.left - frame_rect.left}px`;
    overlay.style.top = `${image_rect.top - frame_rect.top}px`;
    overlay.style.width = `${image_rect.width}px`;
    overlay.style.height = `${image_rect.height}px`;
  }

  RenderAnnotateInspector(selected) {
    const inspector = this.elements.annotate_inspector;
    if (!inspector) return;
    if (!selected) {
      inspector.innerHTML =
        '<p class="text-sm text-muted">เลือกองค์ประกอบเพื่อแก้ไขคุณสมบัติ</p>';
      return;
    }
    const opacity_value = selected.opacity != null ? selected.opacity : 1;
    const rows = [];
    rows.push(
      `<label class="form-field"><span class="form-field-label">ความทึบ</span><input type="range" min="0" max="1" step="0.05" value="${opacity_value}" data-annotate-prop="opacity" class="input-field" /></label>`
    );
    if (selected.type === 'text') {
      const selected_font_key =
        selected.font_key || AnnotationFonts.DefaultKey();
      const font_options_markup = AnnotationFonts.GetOptions()
        .map(font_option => {
          const selected_attribute =
            font_option.key === selected_font_key ? 'selected' : '';
          return `<option value="${font_option.key}" ${selected_attribute}>${font_option.label}</option>`;
        })
        .join('');
      rows.push(
        '<button type="button" data-annotate-action="edit-text" class="input-field" style="cursor: pointer">✎ แก้ข้อความ</button>'
      );
      rows.push(
        `<label class="form-field"><span class="form-field-label">ฟอนต์</span><select data-annotate-prop="font_key" class="input-field">${font_options_markup}</select></label>`
      );
      rows.push(
        `<label class="form-field"><span class="form-field-label">สีข้อความ</span><input type="color" value="${selected.color || '#000000'}" data-annotate-prop="color" class="input-field" /></label>`
      );
      rows.push(
        `<label class="form-field"><span class="form-field-label">ขนาดฟอนต์ (pt)</span><input type="number" min="4" max="400" step="1" value="${this.annotation_editor.GetSelectedFontSizePt()}" data-annotate-fontpt class="input-field" /></label>`
      );
      rows.push(
        `<label class="form-field"><span class="form-field-label">จัดข้อความ</span><select data-annotate-prop="align" class="input-field"><option value="left" ${selected.align === 'left' ? 'selected' : ''}>ซ้าย</option><option value="center" ${selected.align === 'center' ? 'selected' : ''}>กลาง</option><option value="right" ${selected.align === 'right' ? 'selected' : ''}>ขวา</option></select></label>`
      );
    } else if (selected.type === 'block') {
      rows.push(
        `<label class="form-field"><span class="form-field-label">สีพื้น</span><input type="color" value="${selected.fill_color || '#3366ff'}" data-annotate-prop="fill_color" class="input-field" /></label>`
      );
    } else if (selected.type === 'line') {
      rows.push(
        `<label class="form-field"><span class="form-field-label">สีเส้น</span><input type="color" value="${selected.stroke_color || '#ff0000'}" data-annotate-prop="stroke_color" class="input-field" /></label>`
      );
      const ArrowOptionMarkup = (has_arrow, glyph, label) => {
        const is_active = Boolean(selected.has_arrow) === has_arrow;
        return `<button type="button" class="sub-tab-btn annotate-segmented-btn ${is_active ? 'active' : ''}" aria-pressed="${is_active}" data-annotate-arrow="${has_arrow}"><span aria-hidden="true">${glyph}</span>${label}</button>`;
      };
      rows.push(
        `<div class="form-field"><span class="form-field-label" id="annotate-arrow-label">หัวลูกศร</span><div class="annotate-segmented" role="group" aria-labelledby="annotate-arrow-label">${ArrowOptionMarkup(false, '―', 'เส้นตรง')}${ArrowOptionMarkup(true, '→', 'ลูกศร')}</div></div>`
      );
    }
    if (selected.type === 'block' || selected.type === 'image') {
      const natural_option =
        selected.type === 'image'
          ? '<option value="natural">ต้นฉบับรูป</option>'
          : '';
      rows.push(
        `<label class="form-field"><span class="form-field-label">สัดส่วน (Ratio)</span><select data-annotate-ratio class="input-field"><option value="free">อิสระ</option>${natural_option}<option value="1:1">1:1 (จัตุรัส)</option><option value="4:3">4:3</option><option value="3:4">3:4</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label>`
      );
    }
    rows.push(
      '<div class="annotate-toolbar"><button type="button" data-annotate-action="forward">นำหน้า</button><button type="button" data-annotate-action="backward">ถอยหลัง</button><button type="button" data-annotate-action="delete">ลบ</button></div>'
    );
    inspector.innerHTML = rows.join('');
    inspector.querySelectorAll('[data-annotate-prop]').forEach(input => {
      const UpdateAnnotateProperty = () => {
        const prop = input.dataset.annotateProp;
        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
        } else if (input.type === 'range') {
          value = Number(input.value);
        } else {
          value = input.value;
        }
        this.annotation_editor.UpdateSelected({ [prop]: value });
      };
      const event_name =
        input.tagName === 'SELECT' || input.type === 'checkbox'
          ? 'change'
          : 'input';
      input.addEventListener(event_name, UpdateAnnotateProperty);
    });
    inspector.querySelectorAll('[data-annotate-fontpt]').forEach(input => {
      input.addEventListener('input', () => {
        this.annotation_editor.SetSelectedFontSizePt(Number(input.value));
      });
    });
    inspector.querySelectorAll('[data-annotate-ratio]').forEach(select => {
      select.addEventListener('change', () => {
        const value = select.value;
        if (value === 'free') return;
        if (value === 'natural') {
          const current = this.annotation_editor.GetSelected();
          const ratio =
            current && current.natural_ratio ? current.natural_ratio : 1;
          this.annotation_editor.SetSelectedRatio(ratio, 1);
          return;
        }
        const parts = value.split(':').map(Number);
        this.annotation_editor.SetSelectedRatio(parts[0], parts[1]);
      });
    });
    const arrow_buttons = inspector.querySelectorAll('[data-annotate-arrow]');
    arrow_buttons.forEach(button => {
      button.addEventListener('click', () => {
        const has_arrow = button.dataset.annotateArrow === 'true';
        this.annotation_editor.UpdateSelected({ has_arrow: has_arrow });
        arrow_buttons.forEach(option_button => {
          const is_active = option_button === button;
          option_button.classList.toggle('active', is_active);
          option_button.setAttribute('aria-pressed', String(is_active));
        });
      });
    });
    inspector.querySelectorAll('[data-annotate-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.annotateAction;
        if (action === 'delete') {
          this.annotation_editor.DeleteSelected();
        } else if (action === 'edit-text') {
          this.annotation_editor.EditSelectedText();
        } else {
          this.annotation_editor.MoveSelected(action);
        }
      });
    });
  }

  InitializeDarkMode() {
    const saved_mode = localStorage.getItem('dark_mode');
    const is_dark_mode = saved_mode !== 'false';
    document.documentElement.classList.toggle('dark', is_dark_mode);
    this.UpdateDarkModeIcon(is_dark_mode);
  }

  ToggleDarkMode() {
    const is_dark_mode = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', is_dark_mode);
    localStorage.setItem('dark_mode', String(is_dark_mode));
    this.UpdateDarkModeIcon(is_dark_mode);
  }

  UpdateDarkModeIcon(is_dark_mode) {
    if (!this.elements.dark_mode_icon) return;
    this.elements.dark_mode_icon.innerHTML = is_dark_mode
      ? '<i data-lucide="moon" class="icon-20"></i>'
      : '<i data-lucide="sun" class="icon-20"></i>';
    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

function InitializePdfApp() {
  new PdfApp();
}

document.addEventListener('DOMContentLoaded', InitializePdfApp);
