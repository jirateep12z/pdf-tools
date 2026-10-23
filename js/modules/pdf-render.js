const PDF_THUMBNAIL_WIDTH = 240;
const PDF_PREVIEW_WIDTH = 1200;
const PDF_EXPORT_IMAGE_WIDTH = 1600;
const PDF_THUMBNAIL_BACKGROUND = '#ffffff';
const IMAGE_PREVIEW_JPEG_QUALITY = 0.92;
const IMAGE_READ_ERROR_MESSAGE = 'ไม่สามารถอ่านไฟล์รูปภาพนี้ได้';

class PdfRenderModule {
  async LoadPdfDocument(uploaded_file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error(
        'ไม่สามารถโหลด pdf.js ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้า'
      );
    }
    try {
      const loading_task = pdfjsLib.getDocument({
        data: uploaded_file.file_bytes.slice(0)
      });
      return await loading_task.promise;
    } catch (error) {
      if (error?.name === 'PasswordException') {
        throw new Error(
          'ไฟล์ PDF มีรหัสผ่าน กรุณาปลดรหัสผ่านแล้วเลือกไฟล์ใหม่'
        );
      }
      throw new Error(
        'ไม่สามารถอ่านไฟล์ PDF นี้ได้ กรุณาตรวจสอบว่าไฟล์ไม่เสียแล้วลองอีกครั้ง'
      );
    }
  }

  async AttachThumbnails(page_operations) {
    const document_cache = new Map();
    const operations_with_thumbnails = [];
    for (const page_operation of page_operations) {
      let thumbnail_data_url = '';
      try {
        const cache_key = page_operation.file_name;
        let pdf_document = document_cache.get(cache_key);
        if (!pdf_document) {
          pdf_document = await this.LoadPdfDocument({
            file_bytes: page_operation.file_bytes
          });
          document_cache.set(cache_key, pdf_document);
        }
        thumbnail_data_url = await this.RenderPageThumbnail(
          pdf_document,
          page_operation.source_page_index
        );
      } catch (error) {
        thumbnail_data_url = '';
      }
      operations_with_thumbnails.push({
        ...page_operation,
        thumbnail_data_url: thumbnail_data_url
      });
    }
    return operations_with_thumbnails;
  }

  async RenderPageThumbnail(
    pdf_document,
    source_page_index,
    thumbnail_width = PDF_THUMBNAIL_WIDTH
  ) {
    const page = await pdf_document.getPage(source_page_index + 1);
    const base_viewport = page.getViewport({ scale: 1 });
    const scale = thumbnail_width / base_viewport.width;
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvas_context = canvas.getContext('2d');
    if (!canvas_context) {
      throw new Error('ไม่สามารถสร้าง thumbnail ได้');
    }
    canvas_context.fillStyle = PDF_THUMBNAIL_BACKGROUND;
    canvas_context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: canvas_context,
      viewport: viewport
    }).promise;
    return canvas.toDataURL('image/png');
  }

  async RenderPagePreview(pdf_document, source_page_index) {
    return this.RenderPageThumbnail(
      pdf_document,
      source_page_index,
      PDF_PREVIEW_WIDTH
    );
  }

  async RenderImageToDataUrl(uploaded_file, maximum_width) {
    let image_bitmap;
    try {
      image_bitmap = await createImageBitmap(
        new Blob([uploaded_file.file_bytes], { type: uploaded_file.file_type })
      );
    } catch (error) {
      throw new Error(IMAGE_READ_ERROR_MESSAGE);
    }
    try {
      const width_px = image_bitmap.width;
      const height_px = image_bitmap.height;
      const output_width = Math.min(width_px, maximum_width);
      const output_height = Math.max(
        1,
        Math.round((height_px * output_width) / width_px)
      );
      const canvas = document.createElement('canvas');
      canvas.width = output_width;
      canvas.height = output_height;
      const canvas_context = canvas.getContext('2d');
      if (!canvas_context) {
        throw new Error(IMAGE_READ_ERROR_MESSAGE);
      }
      canvas_context.fillStyle = PDF_THUMBNAIL_BACKGROUND;
      canvas_context.fillRect(0, 0, output_width, output_height);
      canvas_context.drawImage(image_bitmap, 0, 0, output_width, output_height);
      return {
        data_url: canvas.toDataURL('image/jpeg', IMAGE_PREVIEW_JPEG_QUALITY),
        width_px: width_px,
        height_px: height_px
      };
    } finally {
      image_bitmap.close();
    }
  }

  async RenderPagesAsImages(uploaded_file, page_indexes) {
    const pdf_document = await this.LoadPdfDocument(uploaded_file);
    const selected_page_numbers = Array.isArray(page_indexes)
      ? page_indexes.map(page_index => page_index + 1)
      : Array.from(
          { length: pdf_document.numPages },
          (_, page_index) => page_index + 1
        );
    const image_files = [];
    for (const page_number of selected_page_numbers) {
      const image_blob = await this.RenderPageAsPngBlob(
        pdf_document,
        page_number
      );
      image_files.push({
        file_name: `page-${page_number}.png`,
        file_blob: image_blob
      });
    }
    return image_files;
  }

  async RenderPageAsPngBlob(pdf_document, page_number) {
    const page = await pdf_document.getPage(page_number);
    const base_viewport = page.getViewport({ scale: 1 });
    const scale = PDF_EXPORT_IMAGE_WIDTH / base_viewport.width;
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvas_context = canvas.getContext('2d');
    if (!canvas_context) {
      throw new Error('ไม่สามารถสร้างภาพจากหน้า PDF ได้');
    }
    canvas_context.fillStyle = PDF_THUMBNAIL_BACKGROUND;
    canvas_context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: canvas_context,
      viewport: viewport
    }).promise;
    const image_blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!image_blob) {
      throw new Error('ไม่สามารถสร้างภาพจากหน้า PDF ได้');
    }
    return image_blob;
  }

  async RenderPageAsJpeg(pdf_document, page_number, render_options) {
    const page = await pdf_document.getPage(page_number);
    const base_viewport = page.getViewport({ scale: 1 });
    const requested_scale = render_options.dpi / 72;
    const requested_pixel_count =
      base_viewport.width *
      requested_scale *
      base_viewport.height *
      requested_scale;
    const capped_scale =
      requested_pixel_count > render_options.maximum_canvas_pixels
        ? requested_scale *
          Math.sqrt(
            render_options.maximum_canvas_pixels / requested_pixel_count
          )
        : requested_scale;
    const viewport = page.getViewport({ scale: capped_scale });
    const canvas = document.createElement('canvas');
    try {
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const canvas_context = canvas.getContext('2d');
      if (!canvas_context) {
        throw new Error(
          'ไม่สามารถสร้างภาพจากหน้า PDF ได้ กรุณาลองใช้เบราว์เซอร์อื่น'
        );
      }
      canvas_context.fillStyle = PDF_THUMBNAIL_BACKGROUND;
      canvas_context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvasContext: canvas_context,
        viewport: viewport
      }).promise;
      const image_blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', render_options.jpeg_quality);
      });
      if (!image_blob) {
        throw new Error('ไม่สามารถสร้างภาพจากหน้า PDF ได้ กรุณาลองอีกครั้ง');
      }
      return {
        image_bytes: await image_blob.arrayBuffer(),
        page_width_points: base_viewport.width,
        page_height_points: base_viewport.height
      };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  }
}
