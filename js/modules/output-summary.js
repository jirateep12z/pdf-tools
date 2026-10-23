const OUTPUT_SUMMARY_EMPTY_VALUE = '-';
const OUTPUT_SUMMARY_NO_FILES_TEXT = 'ยังไม่มีไฟล์ที่เลือก';

class OutputSummaryModule {
  constructor(file_module) {
    this.file_module = file_module;
  }

  Render(summary) {
    const summary_element = document.getElementById('output-summary');
    if (!summary_element || !summary) return;
    const has_source_files = summary.source_file_count > 0;
    const has_export_pages =
      summary.export_page_count !== null &&
      summary.export_page_count !== undefined;
    this.SetValue(
      summary_element,
      'output-file-name',
      summary.output_file_name || OUTPUT_SUMMARY_EMPTY_VALUE
    );
    this.SetValue(
      summary_element,
      'source-files',
      has_source_files
        ? `${summary.source_file_count} ไฟล์ • ${this.file_module.FormatFileSize(summary.source_size_bytes)}`
        : OUTPUT_SUMMARY_NO_FILES_TEXT
    );
    this.SetValue(
      summary_element,
      'source-pages',
      has_source_files
        ? `${summary.source_page_count} หน้า`
        : OUTPUT_SUMMARY_EMPTY_VALUE
    );
    summary_element
      .querySelector('[data-output-summary-row="export-pages"]')
      ?.classList.toggle('hidden', !has_export_pages);
    this.SetValue(
      summary_element,
      'export-pages',
      has_export_pages && has_source_files
        ? `${summary.export_page_count} หน้า`
        : OUTPUT_SUMMARY_EMPTY_VALUE
    );
  }

  SetValue(summary_element, field_key, value_text) {
    const value_element = summary_element.querySelector(
      `[data-output-summary="${field_key}"]`
    );
    if (value_element) {
      value_element.textContent = value_text;
    }
  }
}
