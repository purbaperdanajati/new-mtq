/**
 * ================================================================
 *  document-previewer.config.js
 *
 *  ⚠️  JANGAN isi googleDriveApiKey di sini — file ini ada di GitHub.
 *
 *  API Key diambil otomatis dari kolom DRIVE_API_KEY di Sheet Config
 *  oleh bop-script.js saat runtime. Tidak perlu diubah file ini.
 * ================================================================
 */

const MY_DP_CONFIG = {

    // googleDriveApiKey: // ← DIKOSONGKAN — diisi dari Sheet Config (aman)

    modalId      : 'dp-modal',
    zoomStep     : 0.25,
    zoomMin      : 0.25,
    zoomMax      : 5.0,
    wheelZoomStep: 0.1,
    pdfScale     : 1.5,
    pdfWorkerUrl : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    pdfCmapUrl   : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    debug        : false,
    onOpen       : null,
    onClose      : null,
    onError      : null
};