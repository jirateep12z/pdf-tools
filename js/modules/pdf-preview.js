const PAGE_CARD_QUARTER_TURN_SCALE = 0.75;

class PdfPreviewModule {
  constructor(app) {
    this.app = app;
  }

  RenderFileList(uploaded_files) {
    const file_list_element = document.getElementById('pdf-file-list');
    if (!file_list_element) return;
    file_list_element.innerHTML = '';
    if (!uploaded_files || uploaded_files.length === 0) {
      const empty_element = document.createElement('li');
      empty_element.className = 'pdf-empty-state';
      empty_element.textContent = 'ยังไม่มีไฟล์ที่เลือก';
      file_list_element.appendChild(empty_element);
      return;
    }
    uploaded_files.forEach(uploaded_file => {
      const file_element = document.createElement('li');
      file_element.className = 'pdf-list-item pdf-file-list-item';
      const size_element = document.createElement('span');
      size_element.className = 'pdf-file-list-size';
      size_element.textContent = ` (${this.app.file_module.FormatFileSize(uploaded_file.file_size_bytes)})`;
      file_element.append(
        this.app.file_name_display_module.CreateFileNameElement(
          uploaded_file.file_name
        ),
        size_element
      );
      file_list_element.appendChild(file_element);
    });
  }

  RenderPageOperations(page_operations) {
    const page_list_element = document.getElementById('pdf-page-list');
    if (!page_list_element) return;
    page_list_element.innerHTML = '';
    if (!page_operations || page_operations.length === 0) {
      const empty_element = document.createElement('div');
      empty_element.className = 'pdf-empty-state';
      empty_element.textContent = 'อัปโหลด PDF เพื่อแสดงรายการหน้า';
      page_list_element.appendChild(empty_element);
      return;
    }
    const last_operation_index = page_operations.length - 1;
    page_operations.forEach((page_operation, operation_index) => {
      page_list_element.appendChild(
        this.CreatePageCard(
          page_operation,
          operation_index,
          last_operation_index
        )
      );
    });
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  CreatePageCard(page_operation, operation_index, last_operation_index) {
    const page_card = document.createElement('article');
    page_card.className = page_operation.is_deleted
      ? 'pdf-page-card pdf-page-card-deleted'
      : 'pdf-page-card';
    page_card.setAttribute(
      'aria-label',
      `หน้า ${page_operation.display_page_number} จาก ${page_operation.file_name}`
    );
    page_card.append(
      this.CreatePageCardPreview(page_operation),
      this.CreatePageCardSummary(page_operation),
      this.CreatePageCardActions(
        page_operation,
        operation_index,
        last_operation_index
      )
    );
    return page_card;
  }

  CreatePageCardPreview(page_operation) {
    const preview_element = document.createElement('div');
    preview_element.className = 'pdf-page-card-preview';
    if (page_operation.thumbnail_data_url) {
      const thumbnail_element = document.createElement('img');
      thumbnail_element.className = 'pdf-page-thumbnail';
      thumbnail_element.src = page_operation.thumbnail_data_url;
      thumbnail_element.alt = `ตัวอย่างหน้า ${page_operation.display_page_number}`;
      const rotation_degrees = page_operation.rotation_degrees || 0;
      const is_quarter_turn = rotation_degrees % 180 !== 0;
      thumbnail_element.style.setProperty(
        '--page-rotation',
        `${rotation_degrees}deg`
      );
      thumbnail_element.style.setProperty(
        '--page-scale',
        String(is_quarter_turn ? PAGE_CARD_QUARTER_TURN_SCALE : 1)
      );
      preview_element.appendChild(thumbnail_element);
      return preview_element;
    }
    const placeholder_element = document.createElement('div');
    placeholder_element.className = 'pdf-page-thumbnail-placeholder';
    placeholder_element.setAttribute('aria-hidden', 'true');
    placeholder_element.textContent = `หน้า ${page_operation.display_page_number}`;
    preview_element.appendChild(placeholder_element);
    return preview_element;
  }

  CreatePageCardSummary(page_operation) {
    const summary_element = document.createElement('div');
    summary_element.className = 'pdf-page-summary';
    const title_element = document.createElement('strong');
    title_element.textContent = `หน้า ${page_operation.display_page_number}`;
    const file_name_element = document.createElement('span');
    file_name_element.appendChild(
      this.app.file_name_display_module.CreateFileNameElement(
        page_operation.file_name
      )
    );
    summary_element.append(title_element, file_name_element);
    if (page_operation.is_deleted) {
      const badge_element = document.createElement('span');
      badge_element.className = 'pdf-page-badge';
      badge_element.textContent = 'ลบแล้ว';
      summary_element.appendChild(badge_element);
    }
    return summary_element;
  }

  CreatePageCardActions(page_operation, operation_index, last_operation_index) {
    const actions_element = document.createElement('div');
    actions_element.className = 'pdf-page-actions';
    const is_deleted = Boolean(page_operation.is_deleted);
    const action_specs = [
      {
        action: 'move-up',
        icon: 'arrow-left',
        label: 'ย้ายไปก่อนหน้า',
        is_disabled: operation_index === 0,
        OnClick: () => this.app.MovePageOperation(operation_index, -1)
      },
      {
        action: 'move-down',
        icon: 'arrow-right',
        label: 'ย้ายไปถัดไป',
        is_disabled: operation_index === last_operation_index,
        OnClick: () => this.app.MovePageOperation(operation_index, 1)
      },
      {
        action: 'rotate',
        icon: 'rotate-cw',
        label: 'หมุนหน้า',
        is_disabled: false,
        OnClick: () => this.app.RotatePageOperation(operation_index)
      },
      {
        action: 'delete',
        icon: is_deleted ? 'undo-2' : 'trash-2',
        label: is_deleted ? 'กู้คืนหน้า' : 'ลบหน้า',
        is_disabled: false,
        OnClick: () => this.app.DeletePageOperation(operation_index)
      },
      {
        action: 'preview',
        icon: 'eye',
        label: 'ดูหน้านี้',
        is_disabled: is_deleted,
        OnClick: () => this.app.PreviewPageOperation(operation_index)
      }
    ];
    action_specs.forEach(action_spec => {
      actions_element.appendChild(this.CreateCardActionButton(action_spec));
    });
    return actions_element;
  }

  CreateCardActionButton(action_spec) {
    const action_button = document.createElement('button');
    action_button.type = 'button';
    action_button.dataset.action = action_spec.action;
    action_button.setAttribute('aria-label', action_spec.label);
    action_button.title = action_spec.label;
    action_button.disabled = Boolean(action_spec.is_disabled);
    const icon_element = document.createElement('i');
    icon_element.dataset.lucide = action_spec.icon;
    action_button.appendChild(icon_element);
    action_button.addEventListener('click', action_spec.OnClick);
    return action_button;
  }

  RenderMergeFiles(
    uploaded_files,
    empty_state_text = 'อัปโหลด PDF เพื่อเรียงลำดับไฟล์'
  ) {
    const file_list_element = document.getElementById('merge-file-list');
    if (!file_list_element) return;
    file_list_element.innerHTML = '';
    if (!uploaded_files || uploaded_files.length === 0) {
      const empty_element = document.createElement('div');
      empty_element.className = 'pdf-empty-state';
      empty_element.textContent = empty_state_text;
      file_list_element.appendChild(empty_element);
      return;
    }
    const last_file_index = uploaded_files.length - 1;
    uploaded_files.forEach((uploaded_file, file_index) => {
      file_list_element.appendChild(
        this.CreateMergeFileCard(uploaded_file, file_index, last_file_index)
      );
    });
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  CreateMergeFileCard(uploaded_file, file_index, last_file_index) {
    const file_card = document.createElement('article');
    file_card.className = 'pdf-page-card';
    file_card.setAttribute(
      'aria-label',
      `ไฟล์ที่ ${file_index + 1}: ${uploaded_file.file_name}`
    );
    const order_badge = document.createElement('span');
    order_badge.className = 'pdf-card-order-badge';
    order_badge.textContent = `#${file_index + 1}`;
    const preview_element = this.CreatePageCardPreview({
      thumbnail_data_url: uploaded_file.thumbnail_data_url,
      display_page_number: 1,
      rotation_degrees: 0
    });
    const summary_element = document.createElement('div');
    summary_element.className = 'pdf-page-summary';
    const name_element = document.createElement('strong');
    name_element.appendChild(
      this.app.file_name_display_module.CreateFileNameElement(
        uploaded_file.file_name
      )
    );
    const meta_element = document.createElement('span');
    const is_image_file = IMAGE_FILE_TYPES.includes(uploaded_file.file_type);
    const content_label = is_image_file
      ? this.FormatImageDimensions(uploaded_file)
      : `${uploaded_file.page_count || 0} หน้า`;
    meta_element.textContent = `${content_label} • ${this.app.file_module.FormatFileSize(uploaded_file.file_size_bytes)}`;
    summary_element.append(name_element, meta_element);
    const actions_element = document.createElement('div');
    actions_element.className = 'pdf-page-actions';
    [
      {
        action: 'move-up',
        icon: 'arrow-left',
        label: 'ย้ายไปก่อนหน้า',
        is_disabled: file_index === 0,
        OnClick: () => this.app.MoveUploadedFile(file_index, -1)
      },
      {
        action: 'move-down',
        icon: 'arrow-right',
        label: 'ย้ายไปถัดไป',
        is_disabled: file_index === last_file_index,
        OnClick: () => this.app.MoveUploadedFile(file_index, 1)
      },
      {
        action: 'remove',
        icon: 'x',
        label: 'เอาไฟล์ออก',
        is_disabled: false,
        OnClick: () => this.app.RemoveUploadedFile(file_index)
      },
      {
        action: 'preview',
        icon: 'eye',
        label: is_image_file ? 'ดูรูปนี้' : 'ดูไฟล์นี้',
        is_disabled: false,
        OnClick: () => this.app.PreviewUploadedFile(file_index)
      }
    ].forEach(action_spec => {
      actions_element.appendChild(this.CreateCardActionButton(action_spec));
    });
    file_card.append(
      order_badge,
      preview_element,
      summary_element,
      actions_element
    );
    return file_card;
  }

  FormatImageDimensions(uploaded_file) {
    if (!(uploaded_file.width_px > 0) || !(uploaded_file.height_px > 0)) {
      return 'ไม่ทราบขนาด';
    }
    return `${uploaded_file.width_px} × ${uploaded_file.height_px} px`;
  }

  RenderExtractedText(text_files, empty_state_text) {
    const text_output_element = document.getElementById('text-output');
    if (!text_output_element) return;
    text_output_element.replaceChildren();
    const files_with_text = (text_files || []).filter(
      text_file => text_file.pages.length > 0
    );
    if (files_with_text.length === 0) {
      const empty_element = document.createElement('div');
      empty_element.className = 'pdf-empty-state';
      empty_element.textContent = empty_state_text;
      text_output_element.appendChild(empty_element);
      return;
    }
    files_with_text.forEach(text_file => {
      text_output_element.appendChild(this.CreateExtractedTextFile(text_file));
    });
  }

  CreateExtractedTextFile(text_file) {
    const file_element = document.createElement('article');
    file_element.className = 'text-file';
    const name_element = document.createElement('h4');
    name_element.textContent = text_file.file_name;
    file_element.appendChild(name_element);
    text_file.pages.forEach(text_page => {
      const page_element = document.createElement('section');
      page_element.className = 'text-page';
      const label_element = document.createElement('span');
      label_element.className = 'text-page-label';
      label_element.textContent = `หน้า ${text_page.page_number}`;
      const content_element = document.createElement('p');
      content_element.className = 'text-page-content';
      content_element.textContent = text_page.text;
      page_element.append(label_element, content_element);
      file_element.appendChild(page_element);
    });
    return file_element;
  }

  RenderSplitPages(split_pages, selected_page_indexes) {
    const page_list_element = document.getElementById('split-page-list');
    const count_element = document.getElementById('split-selection-count');
    if (!page_list_element) return;
    const focused_page_index = page_list_element.contains(
      document.activeElement
    )
      ? document.activeElement.dataset.pageIndex
      : undefined;
    const page_total = split_pages ? split_pages.length : 0;
    if (count_element) {
      count_element.textContent =
        page_total === 0
          ? ''
          : `เลือก ${selected_page_indexes.size} จาก ${page_total} หน้า`;
    }
    page_list_element.innerHTML = '';
    if (page_total === 0) {
      const empty_element = document.createElement('div');
      empty_element.className = 'pdf-empty-state';
      empty_element.textContent = 'อัปโหลด PDF เพื่อเลือกหน้า';
      page_list_element.appendChild(empty_element);
      return;
    }
    split_pages.forEach((split_page, page_index) => {
      page_list_element.appendChild(
        this.CreateSplitPageCard(
          split_page,
          page_index,
          selected_page_indexes.has(page_index)
        )
      );
    });
    if (window.lucide) {
      lucide.createIcons();
    }
    if (focused_page_index !== undefined) {
      page_list_element
        .querySelector(
          `[data-action="toggle"][data-page-index="${focused_page_index}"]`
        )
        ?.focus();
    }
  }

  CreateSplitPageCard(split_page, page_index, is_selected) {
    const page_number = page_index + 1;
    const page_card = document.createElement('article');
    page_card.className = is_selected
      ? 'pdf-page-card pdf-page-card-selected'
      : 'pdf-page-card';
    page_card.setAttribute('aria-label', `หน้า ${page_number}`);
    const preview_element = this.CreatePageCardPreview({
      thumbnail_data_url: split_page.thumbnail_data_url,
      display_page_number: page_number,
      rotation_degrees: 0
    });
    const toggle_button = document.createElement('button');
    toggle_button.type = 'button';
    toggle_button.className = 'pdf-page-card-preview pdf-page-select-button';
    toggle_button.dataset.action = 'toggle';
    toggle_button.dataset.pageIndex = String(page_index);
    toggle_button.setAttribute('aria-pressed', String(is_selected));
    toggle_button.setAttribute('aria-label', `เลือกหน้า ${page_number}`);
    toggle_button.append(...preview_element.childNodes);
    if (is_selected) {
      const check_badge = document.createElement('span');
      check_badge.className = 'pdf-card-check-badge';
      const check_icon = document.createElement('i');
      check_icon.dataset.lucide = 'check';
      check_badge.appendChild(check_icon);
      toggle_button.appendChild(check_badge);
    }
    toggle_button.addEventListener('click', () =>
      this.app.ToggleSplitPage(page_index)
    );
    const summary_element = document.createElement('div');
    summary_element.className = 'pdf-page-summary';
    const label_element = document.createElement('strong');
    label_element.textContent = `หน้า ${page_number}`;
    summary_element.appendChild(label_element);
    const actions_element = document.createElement('div');
    actions_element.className = 'pdf-page-actions';
    actions_element.appendChild(
      this.CreateCardActionButton({
        action: 'preview',
        icon: 'eye',
        label: 'ดูหน้านี้',
        is_disabled: false,
        OnClick: () => this.app.PreviewSplitPage(page_index)
      })
    );
    page_card.append(toggle_button, summary_element, actions_element);
    return page_card;
  }

  RenderPdfPreview(preview_result) {
    const preview_image_element = document.getElementById('pdf-preview-image');
    const preview_placeholder_element = document.getElementById(
      'pdf-preview-placeholder'
    );
    const preview_meta_element = document.getElementById('pdf-preview-meta');
    if (!preview_image_element || !preview_placeholder_element) return;

    if (!preview_result || !preview_result.thumbnail_data_url) {
      preview_image_element.removeAttribute('src');
      preview_image_element.style.transform = '';
      preview_image_element.classList.add('hidden');
      preview_placeholder_element.classList.remove('hidden');
      if (preview_meta_element) {
        preview_meta_element.textContent = 'อัปโหลด PDF เพื่อดูตัวอย่าง';
      }
      this.RenderPreviewNavigation(0, 0);
      return;
    }

    preview_image_element.src = preview_result.thumbnail_data_url;
    preview_image_element.alt = `ตัวอย่างหน้า ${preview_result.page_number} ของ ${preview_result.file_name}`;
    preview_image_element.style.transform = `rotate(${preview_result.rotation_degrees || 0}deg)`;
    preview_image_element.classList.remove('hidden');
    preview_placeholder_element.classList.add('hidden');
    if (preview_meta_element) {
      const meta_suffix = preview_result.meta_suffix
        ? ` • ${preview_result.meta_suffix}`
        : '';
      const detail_element = document.createElement('span');
      detail_element.className = 'pdf-preview-meta-detail';
      detail_element.textContent = `${meta_suffix} • หน้า ${preview_result.page_number}/${preview_result.file_page_count}`;
      preview_meta_element.replaceChildren(
        this.app.file_name_display_module.CreateFileNameElement(
          preview_result.file_name
        ),
        detail_element
      );
    }
    this.RenderPreviewNavigation(
      preview_result.preview_page_number,
      preview_result.preview_page_count
    );
  }

  RenderPreviewNavigation(preview_page_number, preview_page_count) {
    const previous_button_element = document.getElementById(
      'pdf-preview-previous-button'
    );
    const next_button_element = document.getElementById(
      'pdf-preview-next-button'
    );
    const page_indicator_element = document.getElementById(
      'pdf-preview-page-indicator'
    );
    if (page_indicator_element) {
      page_indicator_element.textContent = `${preview_page_number} / ${preview_page_count}`;
    }
    if (previous_button_element) {
      previous_button_element.disabled = preview_page_number <= 1;
    }
    if (next_button_element) {
      next_button_element.disabled =
        preview_page_count === 0 || preview_page_number >= preview_page_count;
    }
  }
}
