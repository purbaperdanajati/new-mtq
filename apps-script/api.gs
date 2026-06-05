// ============================================================
//  MTQ 2026 — apps-script/api.gs  (rev 6)
//  Fix #3: NIK dup check, #6: bank fields, #7: sertifikat upload
// ============================================================

var CABANG_PREFIX = [
  { key:'Tilawah Anak',         prefix:'TWA' },
  { key:'Tilawah Remaja',       prefix:'TWR' },
  { key:'Tilawah Dewasa',       prefix:'TWD' },
  { key:'Tilawah Cacat',        prefix:'TWC' },
  { key:'Tahfidz 1 Juz',        prefix:'TH1' },
  { key:'Tahfidz 5 Juz',        prefix:'TH5' },
  { key:'Tahfidz 10 Juz',       prefix:'T10' },
  { key:'Tahfidz 20 Juz',       prefix:'T20' },
  { key:'Tahfidz 30 Juz',       prefix:'T30' },
  { key:'Khat Naskhi',          prefix:'KHN' },
  { key:'Khat Hiasan Mushaf',   prefix:'KHH' },
  { key:"Fahmil Qur'an",        prefix:'FHM' },
  { key:"Syarhil Qur'an",       prefix:'SYR' },
  { key:'MFQ',                  prefix:'MFQ' },
  { key:'Tartil',               prefix:'TTL' },
];

function getCabangPrefix_(cabangLomba) {
  var name = String(cabangLomba).trim();
  for (var i=0; i<CABANG_PREFIX.length; i++) {
    if (name.indexOf(CABANG_PREFIX[i].key) === 0) return CABANG_PREFIX[i].prefix;
  }
  return 'MTQ';
}

// ── PATCH: All admin actions moved to doGet (JSONP bypass) ────
// Replace the doGet switch in api.gs with this version

function doGet(e) {
  var action = (e && e.parameter) ? (e.parameter.action||'') : '';
  logInfo('api','doGet',{action:action});
  var result;
  try {
    switch(action) {
      // ── Public endpoints ──────────────────────────────────
      case 'ping'         : result = {success:true, pong:true, ts:new Date().toISOString()}; break;
      case 'getConfig'      : result = apiGetConfig_();                   break;
      case 'getStats'       : result = apiGetStats_();                    break;
      case 'getQuota'       : result = apiGetQuota_(e.parameter);         break;
      case 'checkDuplicate' : result = apiCheckDuplicate_(e.parameter);   break;
      case 'checkNIK'       : result = apiCheckNIK_(e.parameter);         break;
      case 'initSheets'     : result = {success:true,msg:initAllSheets()}; break;
      case 'debugConfig'    : result = apiDebugConfig_();                  break;

      // ── Admin endpoints (all JSONP GET — token validated inside) ──
      case 'adminLogin'     : result = apiAdminLogin_(e.parameter);        break;
      case 'getAllPendaftar' : result = apiGetAll_(e.parameter);            break;
      case 'updateStatus'   : result = apiUpdateStatusGet_(e.parameter);   break;
      case 'editPeserta'    : result = apiEditPesertaGet_(e.parameter);    break;
      case 'deactivate'     : result = apiDeactivateGet_(e.parameter);     break;

      default: result = {success:true,message:'MTQ 2026 API aktif',event:EVENT_INFO};
    }
  } catch(err) {
    logError('api','doGet ERROR: '+err.message+' | '+err.stack);
    result = {success:false,message:err.message};
  }
  var ss=null; try{ss=SpreadsheetApp.openById(SPREADSHEET_ID);}catch(e2){}
  _flushLog(ss);
  if (e && e.parameter && e.parameter.callback) {
    return ContentService
      .createTextOutput(e.parameter.callback+'('+JSON.stringify(result)+')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResp_(result);
}

// doPost kept for registration only (large base64 payload)
function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    logInfo('api','doPost action: '+body.action);
    if (body.action === 'register') {
      result = apiRegister_(body);
    } else {
      result = {success:false, message:'Unknown POST action: '+body.action};
    }
  } catch(err) {
    logError('api','doPost ERROR: '+err.message);
    result = {success:false, message:err.message};
  }
  var ss=null; try{ss=SpreadsheetApp.openById(SPREADSHEET_ID);}catch(e2){}
  _flushLog(ss);
  return jsonResp_(result);
}

// ── adminLogin via GET ─────────────────────────────────────────
// Password dikirim sebagai base64 untuk menghindari URL-encoding
// char spesial (@, !, #, dll). Decode di server sebelum compare.
function apiAdminLogin_(params) {
  logInfo('api','apiAdminLogin_ GET — param keys: '+Object.keys(params||{}).join(','));
  var incoming = '';
  try {
    var b64 = String(params.pw || '').trim();
    logInfo('api','pw param length: '+b64.length);
    if (!b64) {
      // fallback: plain password
      incoming = String(params.password || '').trim();
      logInfo('api','Fallback plain password, length: '+incoming.length);
    } else {
      // Decode base64
      var decoded = Utilities.base64Decode(b64, Utilities.Charset.UTF_8);
      incoming = Utilities.newBlob(decoded).getDataAsString();
      logInfo('api','b64 decoded, incoming.length: '+incoming.length);
    }
  } catch(e) {
    logError('api','Decode error: '+e.message);
    return {success:false, message:'Gagal mendekode password: '+e.message};
  }

  var expected = String(ADMIN_PASSWORD || '').trim();
  logInfo('api','incoming.length='+incoming.length+' expected.length='+expected.length);

  // Char-by-char debug (hapus setelah konfirmasi bekerja)
  var inChars = incoming.split('').map(function(c){return c.charCodeAt(0);}).join(',');
  var exChars = expected.split('').map(function(c){return c.charCodeAt(0);}).join(',');
  logInfo('api','incoming chars: ['+inChars+']');
  logInfo('api','expected chars: ['+exChars+']');

  if (!incoming) return {success:false, message:'Password tidak boleh kosong'};
  if (incoming !== expected) {
    logWarn('api','Login GAGAL — tidak cocok');
    return {success:false, message:'Password salah. Periksa Apps Script Logger untuk debug detail.'};
  }
  var token = genToken_();
  logInfo('api','Login BERHASIL, token.length='+token.length);
  return {success:true, token:token};
}

// ── Admin GET handlers ─────────────────────────────────────────
function apiUpdateStatusGet_(p) {
  if (!isTokenValid_(p.token)) return {success:false, message:'Sesi tidak valid'};
  return updateRowField_(p.nomor, COL.STATUS_VERIFIKASI, p.status, p.catatan||'');
}

function apiEditPesertaGet_(p) {
  if (!isTokenValid_(p.token)) return {success:false, message:'Sesi tidak valid'};
  var fieldMap = {
    nama_lengkap:'NAMA_LENGKAP', nik:'NIK', tempat_lahir:'TEMPAT_LAHIR',
    tanggal_lahir:'TANGGAL_LAHIR', jenis_kelamin:'JENIS_KELAMIN',
    alamat:'ALAMAT', no_hp:'NO_HP', email:'EMAIL', kecamatan:'KECAMATAN',
    nama_bank:'NAMA_BANK', nomor_rekening:'NOMOR_REKENING',
    nama_rekening:'NAMA_REKENING', catatan:'CATATAN',
  };
  var field = String(p.field||'');
  if (!fieldMap[field]) return {success:false, message:'Field tidak diizinkan: '+field};
  return updateRowField_(p.nomor, COL[fieldMap[field]], p.value||'', null);
}

function apiDeactivateGet_(p) {
  if (!isTokenValid_(p.token)) return {success:false, message:'Sesi tidak valid'};
  return updateRowField_(p.nomor, COL.STATUS_VERIFIKASI, 'Nonaktif',
                         p.catatan||'Dinonaktifkan oleh admin');
}


function jsonResp_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── debugConfig ───────────────────────────────────────────────
function apiDebugConfig_() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_CONFIG);
    if (!sheet) return { success:false, message:'Sheet CONFIG tidak ditemukan', sheetNames:ss.getSheets().map(function(s){return s.getName();}) };
    var rows = sheet.getDataRange().getValues();
    return { success:true, sheetName:sheet.getName(), totalRows:rows.length, headers:rows[0], sampleRows:rows.slice(1,6), expectedHeaders:CONFIG_HEADERS };
  } catch(err) { return { success:false, message:err.message }; }
}

// ── checkDuplicate (kecamatan+cabang) ────────────────────────
function apiCheckDuplicate_(params) {
  var kecamatan = String(params.kecamatan||'').trim();
  var cabang    = String(params.cabang   ||'').trim();
  if (!kecamatan || !cabang) return { success:false, message:'Parameter tidak lengkap' };
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow()<=1) return { success:true, isDuplicate:false, count:0 };
  var rows  = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  var count = 0;
  rows.forEach(function(row) {
    var s = String(row[COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if (s==='nonaktif') return;
    if (String(row[COL.KECAMATAN]||'').trim()===kecamatan && String(row[COL.CABANG_LOMBA]||'').trim()===cabang) count++;
  });
  return { success:true, isDuplicate:count>0, count:count };
}

// ── checkNIK (FIX #3) ─────────────────────────────────────────
function apiCheckNIK_(params) {
  var nik = String(params.nik||'').trim();
  if (!nik) return { success:false, message:'NIK kosong' };
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var check = checkNIKDuplicate_(sheet, [nik]);
  return { success:true, isDuplicate:check.isDuplicate, nik:nik, msg:check.msg||'' };
}

// ── getConfig ─────────────────────────────────────────────────
function apiGetConfig_() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS, DEFAULT_CONFIG_DATA);
  var rows  = sheet.getDataRange().getValues();
  var hdrs  = rows[0].map(function(h){return String(h).trim().toLowerCase().replace(/\s+/g,'_');});
  var config = [];
  for (var i=1; i<rows.length; i++) {
    var r=rows[i], obj={};
    hdrs.forEach(function(h,j){obj[h]=r[j]!==undefined?r[j]:'';});
    var nm = String(obj.cabang_lomba||'').trim();
    if (!nm) continue;
    if (String(obj.status_aktif||'').trim().toLowerCase()!=='aktif') continue;
    config.push({
      cabang_lomba:nm, tipe:String(obj.tipe||'individu').trim(), gender:String(obj.gender||'Semua').trim(),
      umur_min:parseInt(obj.umur_min)||0, umur_max_tahun:parseInt(obj.umur_max_tahun)||99,
      umur_max_bulan:parseInt(obj.umur_max_bulan)||0, umur_max_hari:parseInt(obj.umur_max_hari)||0,
      kuota:parseInt(obj.kuota)||31, status_aktif:'Aktif',
    });
  }
  if (config.length===0) {
    logWarn('api','CONFIG kosong — pakai DEFAULT');
    config = DEFAULT_CONFIG_DATA.map(function(row){
      return { cabang_lomba:String(row[0]).trim(), tipe:String(row[1]).trim(), gender:String(row[2]).trim(),
               umur_min:parseInt(row[3])||0, umur_max_tahun:parseInt(row[4])||99,
               umur_max_bulan:parseInt(row[5])||0, umur_max_hari:parseInt(row[6])||0,
               kuota:parseInt(row[7])||31, status_aktif:'Aktif' };
    });
  }
  var regStatus = isRegistrationOpen_();
  return { success:true, config:config,
    registrationConfig:{ buka:PENDAFTARAN_CONFIG.BUKA, tutup:PENDAFTARAN_CONFIG.TUTUP,
      ageCutoffDate:PENDAFTARAN_CONFIG.AGE_CUTOFF_DATE, isOpen:regStatus.open, status:regStatus.status },
    event:EVENT_INFO };
}

// ── getStats ──────────────────────────────────────────────────
function apiGetStats_() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow()<=1) return { success:true, total:0, verified:0, pending:0, rejected:0, nonaktif:0, cabangs:0, kecamatans:0 };
  var data = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  var verified=0,pending=0,rejected=0,nonaktif=0,cabangs={},kecs={};
  data.forEach(function(row) {
    var s=String(row[COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if(s==='terverifikasi')verified++;else if(s==='ditolak')rejected++;else if(s==='nonaktif')nonaktif++;else pending++;
    var cb=row[COL.CABANG_LOMBA];if(cb)cabangs[cb]=1;
    var kc=row[COL.KECAMATAN];if(kc)kecs[kc]=1;
  });
  var regStatus = isRegistrationOpen_();
  return { success:true, total:data.length, verified:verified, pending:pending, rejected:rejected, nonaktif:nonaktif,
           cabangs:Object.keys(cabangs).length, kecamatans:Object.keys(kecs).length,
           isOpen:regStatus.open, status:regStatus.status,
           buka:PENDAFTARAN_CONFIG.BUKA, tutup:PENDAFTARAN_CONFIG.TUTUP };
}

// ── getQuota ──────────────────────────────────────────────────
function apiGetQuota_(params) {
  var cabang = String(params.cabang||'').trim();
  var ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet  = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  return { success:true, count:countByCabangActive_(sheet,cabang), cabang:cabang };
}



// ── getAllPendaftar (GET via JSONP) ────────────────────────────
function apiGetAll_(params) {
  var token = String(params.token || '').trim();
  logInfo('api','apiGetAll_ token length: '+token.length);
  if (!isTokenValid_(token)) {
    logWarn('api','apiGetAll_ — token tidak valid');
    return { success:false, message:'Sesi tidak valid. Silakan login ulang.' };
  }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow()<=1) return { success:true, data:[] };
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  logInfo('api','apiGetAll_ — rows: '+rows.length);
  return { success:true, data:rows.map(function(r){ return rowToObj_(r); }) };
}





// ── register ──────────────────────────────────────────────────
function apiRegister_(body) {
  logInfo('api','apiRegister_ START',{cabang:body.cabang_lomba,kecamatan:body.kecamatan});

  // 1. Status pendaftaran
  var regStatus = isRegistrationOpen_();
  if (!regStatus.open) {
    var msg = regStatus.status==='belum_buka'
      ? 'Pendaftaran belum dibuka (buka per '+PENDAFTARAN_CONFIG.BUKA+').'
      : 'Pendaftaran telah ditutup.';
    return { success:false, message:msg };
  }

  // 2. Cari config cabang
  var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cfgSheet   = getOrCreateSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS, DEFAULT_CONFIG_DATA);
  var cfgData    = cfgSheet.getDataRange().getValues();
  var cfgHdr     = cfgData[0].map(function(h){return String(h).trim().toLowerCase().replace(/\s+/g,'_');});
  var cabangIdx  = cfgHdr.indexOf('cabang_lomba');
  var targetCabang = String(body.cabang_lomba||'').trim();
  var cabangCfg  = null;

  for (var ci=1; ci<cfgData.length; ci++) {
    if (String(cfgData[ci][cabangIdx]||'').trim()===targetCabang) {
      var crow = cfgData[ci];
      cabangCfg = {
        tipe:String(crow[cfgHdr.indexOf('tipe')]||'individu').trim(),
        gender:String(crow[cfgHdr.indexOf('gender')]||'Semua').trim(),
        umur_min:parseInt(crow[cfgHdr.indexOf('umur_min')])||0,
        umur_max_tahun:parseInt(crow[cfgHdr.indexOf('umur_max_tahun')])||99,
        umur_max_bulan:parseInt(crow[cfgHdr.indexOf('umur_max_bulan')])||0,
        umur_max_hari:parseInt(crow[cfgHdr.indexOf('umur_max_hari')])||0,
        kuota:parseInt(crow[cfgHdr.indexOf('kuota')])||31,
        status:String(crow[cfgHdr.indexOf('status_aktif')]||'').trim(),
      };
      break;
    }
  }
  // Fallback ke DEFAULT
  if (!cabangCfg) {
    for (var di=0; di<DEFAULT_CONFIG_DATA.length; di++) {
      if (String(DEFAULT_CONFIG_DATA[di][0]).trim()===targetCabang) {
        var dr=DEFAULT_CONFIG_DATA[di];
        cabangCfg={tipe:String(dr[1]).trim(),gender:String(dr[2]).trim(),
          umur_min:parseInt(dr[3])||0,umur_max_tahun:parseInt(dr[4])||99,
          umur_max_bulan:parseInt(dr[5])||0,umur_max_hari:parseInt(dr[6])||0,
          kuota:parseInt(dr[7])||31,status:'Aktif'};
        break;
      }
    }
  }
  if (!cabangCfg) return { success:false, message:'Cabang tidak ditemukan: '+targetCabang };
  if (String(cabangCfg.status).toLowerCase()!=='aktif') return { success:false, message:'Cabang tidak aktif.' };

  // 3. Validasi anggota
  var members = body.members||[];
  if (!members.length) return { success:false, message:'Data peserta tidak boleh kosong' };
  if (cabangCfg.tipe==='team' && members.length<2) return { success:false, message:'Tim minimal 2 anggota' };
  if (cabangCfg.tipe==='team' && members.length>3) return { success:false, message:'Tim maksimal 3 anggota' };

  for (var mi=0; mi<members.length; mi++) {
    var m=members[mi], label='Anggota '+(mi+1)+' ('+(m.nama_lengkap||'-')+')';
    var gChk=validateGender_(m.jenis_kelamin, cabangCfg.gender);
    if (!gChk.ok) return { success:false, message:label+': '+gChk.msg };
    var age=calcAgeAtCutoff_(m.tanggal_lahir);
    var aChk=validateAge_(age, cabangCfg.umur_min, cabangCfg.umur_max_tahun, cabangCfg.umur_max_bulan, cabangCfg.umur_max_hari);
    if (!aChk.ok) return { success:false, message:label+': '+aChk.msg };
    m._age = age;
  }

  // 4. Cek duplikat kecamatan+cabang
  var pendSheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var dupCheck  = checkDuplicateKecCabang_(pendSheet, body.kecamatan, targetCabang);
  if (dupCheck.isDuplicate) return { success:false, message:'Kecamatan '+body.kecamatan+' sudah mendaftarkan peserta pada cabang '+targetCabang+'.' };

  // 5. FIX #3: Cek duplikat NIK di semua anggota
  var allNIKs = members.map(function(m){return m.nik||'';}).filter(Boolean);
  var nikCheck = checkNIKDuplicate_(pendSheet, allNIKs);
  if (nikCheck.isDuplicate) return { success:false, message:nikCheck.msg };

  // 6. Kuota
  var curCount = countByCabangActive_(pendSheet, targetCabang);
  if (curCount>=cabangCfg.kuota) return { success:false, message:'Kuota '+targetCabang+' sudah penuh ('+cabangCfg.kuota+')' };

  // 7. Nomor pendaftaran
  var gender = cabangCfg.gender;
  var nomor  = generateRegNumberOddEven_(pendSheet, targetCabang, gender);
  logInfo('api','Nomor: '+nomor);

  // 8. Upload files
  var pesertaFolder = getPesertaFolder_(targetCabang, body.kecamatan, nomor);
  var folderUrl     = 'https://drive.google.com/drive/folders/'+pesertaFolder.getId();
  var processedMembers = [];
  for (var mi2=0; mi2<members.length; mi2++) {
    var m2=members[mi2], prefix2=(m2.nama_lengkap||'A'+(mi2+1)).replace(/\s+/g,'_').substring(0,30);
    var links = uploadMemberFiles_(m2, pesertaFolder, prefix2);
    // FIX #7: upload sertifikat
    var linkSert = uploadFile_(m2.sertifikat, pesertaFolder, 'SERTIFIKAT_'+prefix2);
    processedMembers.push({
      nama_lengkap:m2.nama_lengkap||'', nik:m2.nik||'',
      tempat_lahir:m2.tempat_lahir||'', tanggal_lahir:m2.tanggal_lahir||'',
      umur_display:m2._age?m2._age.display:'', jenis_kelamin:m2.jenis_kelamin||'',
      alamat:m2.alamat||'', no_hp:m2.no_hp||'', email:m2.email||'',
      link_foto:links.foto, link_ktp:links.ktp, link_sertifikat:linkSert,
    });
  }
  // FIX #11: Rekomendasi mandatory — upload saja, validasi di frontend
  uploadFile_(body.rekom, pesertaFolder, 'REKOMENDASI');

  // 9. Simpan ke sheet
  var lead=processedMembers[0];
  var row=new Array(PENDAFTAR_HEADERS.length).fill('');
  row[COL.TIMESTAMP]         = new Date().toLocaleString('id-ID');
  row[COL.NOMOR_PENDAFTARAN] = nomor;
  row[COL.TIPE_LOMBA]        = cabangCfg.tipe;
  row[COL.NAMA_TIM]          = body.nama_tim||'';
  row[COL.KECAMATAN]         = body.kecamatan||'';
  row[COL.CABANG_LOMBA]      = targetCabang;
  row[COL.GENDER_CABANG]     = cabangCfg.gender;
  row[COL.NAMA_LENGKAP]      = lead.nama_lengkap;
  row[COL.NIK]               = lead.nik;
  row[COL.TEMPAT_LAHIR]      = lead.tempat_lahir;
  row[COL.TANGGAL_LAHIR]     = lead.tanggal_lahir;
  row[COL.UMUR_DISPLAY]      = lead.umur_display;
  row[COL.JENIS_KELAMIN]     = lead.jenis_kelamin;
  row[COL.ALAMAT]            = lead.alamat;
  row[COL.NO_HP]             = lead.no_hp;
  row[COL.EMAIL]             = lead.email;
  row[COL.NAMA_BANK]         = body.nama_bank||'';
  row[COL.NOMOR_REKENING]    = body.nomor_rekening||'';
  row[COL.NAMA_REKENING]     = body.nama_rekening||'';
  row[COL.LINK_FOLDER]       = folderUrl;
  row[COL.ANGGOTA_JSON]      = cabangCfg.tipe==='team' ? JSON.stringify(processedMembers) : '';
  row[COL.STATUS_VERIFIKASI] = 'Menunggu';
  pendSheet.appendRow(row);
  writeLog_(ss,'REGISTER',nomor+' | '+targetCabang+' | '+(body.kecamatan||''),'ok');

  return { success:true, nomor_pendaftaran:nomor, tipe_lomba:cabangCfg.tipe,
           cabang_lomba:targetCabang, kecamatan:body.kecamatan,
           jumlah_anggota:processedMembers.length, link_folder:folderUrl, message:'Pendaftaran berhasil!' };
}

// ── initSheets (callable via GET) ────────────────────────────
function apiInitSheets_() {
  return { success:true, msg: initAllSheets() };
}

// ── Helpers ───────────────────────────────────────────────────
function checkDuplicateKecCabang_(sheet, kecamatan, cabang) {
  if (sheet.getLastRow()<=1) return { isDuplicate:false };
  var kecT=String(kecamatan||'').trim(), cabT=String(cabang||'').trim();
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  for (var i=0; i<rows.length; i++) {
    var s=String(rows[i][COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if (s==='nonaktif') continue;
    if (String(rows[i][COL.KECAMATAN]||'').trim()===kecT && String(rows[i][COL.CABANG_LOMBA]||'').trim()===cabT) return {isDuplicate:true};
  }
  return {isDuplicate:false};
}

function countByCabangActive_(sheet, cabang) {
  if (sheet.getLastRow()<=1) return 0;
  var data=sheet.getRange(2,COL.CABANG_LOMBA+1,sheet.getLastRow()-1,1).getValues();
  var stat=sheet.getRange(2,COL.STATUS_VERIFIKASI+1,sheet.getLastRow()-1,1).getValues();
  var count=0;
  for (var i=0;i<data.length;i++) {
    if (String(data[i][0]).trim()===String(cabang).trim() && String(stat[i][0]).toLowerCase()!=='nonaktif') count++;
  }
  return count;
}

function generateRegNumberOddEven_(sheet, cabangLomba, gender) {
  var prefix = getCabangPrefix_(cabangLomba);
  var isOdd  = (gender==='P');
  var isEven = (gender==='L');
  var used   = {};
  if (sheet.getLastRow()>1) {
    var nums = sheet.getRange(2,COL.NOMOR_PENDAFTARAN+1,sheet.getLastRow()-1,1).getValues();
    var stats= sheet.getRange(2,COL.STATUS_VERIFIKASI+1,sheet.getLastRow()-1,1).getValues();
    nums.forEach(function(r,i){
      var m=String(r[0]).match(new RegExp('^'+prefix+'-(\\d+)$'));
      if (m) used[parseInt(m[1])]=true;
    });
  }
  for (var n=1; n<=62; n++) {
    if (isOdd  && n%2===0) continue;
    if (isEven && n%2===1) continue;
    if (!used[n]) return prefix+'-'+String(n).padStart(3,'0');
  }
  var max=Object.keys(used).length ? Math.max.apply(null,Object.keys(used).map(Number)) : 0;
  return prefix+'-'+String(max+1).padStart(3,'0');
}