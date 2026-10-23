const PDF_FILE_TYPE = 'application/pdf';
const IMAGE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

class PdfFileModule {
  ValidateFiles(file_list, accepted_file_types) {
    const files = Array.from(file_list || []);
    if (files.length === 0) {
      return {
        is_valid: false,
        error_message: 'กรุณาเลือกไฟล์ก่อน'
      };
    }
    const has_invalid_file = files.some(file => {
      return !file || !accepted_file_types.includes(file.type);
    });
    if (has_invalid_file) {
      const accepts_pdf_only =
        accepted_file_types.length === 1 &&
        accepted_file_types[0] === PDF_FILE_TYPE;
      return {
        is_valid: false,
        error_message: accepts_pdf_only
          ? 'กรุณาเลือกไฟล์ PDF'
          : 'กรุณาเลือกไฟล์รูปภาพ JPG, PNG หรือ WebP'
      };
    }
    return {
      is_valid: true,
      error_message: ''
    };
  }

  ValidateMaximumFileSize(
    file_list,
    maximum_file_size_bytes,
    maximum_file_size_label
  ) {
    const files = Array.from(file_list || []);
    const has_oversized_file = files.some(file => {
      return file && file.size > maximum_file_size_bytes;
    });
    return has_oversized_file
      ? {
          is_valid: false,
          error_message: `ไฟล์ PDF ต้องมีขนาดไม่เกิน ${maximum_file_size_label} กรุณาเลือกไฟล์ที่เล็กกว่า`
        }
      : { is_valid: true, error_message: '' };
  }

  async ReadFiles(file_list, accepted_file_types) {
    const validation_result = this.ValidateFiles(
      file_list,
      accepted_file_types
    );
    if (!validation_result.is_valid) {
      throw new Error(validation_result.error_message);
    }
    const files = Array.from(file_list);
    const uploaded_files = [];
    for (const file of files) {
      const file_bytes = await file.arrayBuffer();
      uploaded_files.push({
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        file_bytes: file_bytes
      });
    }
    return uploaded_files;
  }

  FormatFileSize(file_size_bytes) {
    if (!Number.isFinite(file_size_bytes) || file_size_bytes < 0) {
      return '0 B';
    }
    if (file_size_bytes >= BYTES_PER_MB) {
      return `${(file_size_bytes / BYTES_PER_MB).toFixed(1)} MB`;
    }
    if (file_size_bytes >= BYTES_PER_KB) {
      return `${(file_size_bytes / BYTES_PER_KB).toFixed(1)} KB`;
    }
    return `${file_size_bytes} B`;
  }
}
