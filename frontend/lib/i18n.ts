import type { Lang } from "./types";

const id = {
  appName: "Field Shift",
  steps: { label: "Langkah", land: "Pilih lahan", plan: "Isi rencana", results: "Lihat hasil" },
  stepOf: (n: number) => `Langkah ${n}/2`,
  language: "Bahasa",
  search: {
    label: "Cari desa atau koordinat",
    placeholder: "Cari desa, atau ketik lat, lon",
    submit: "Cari",
    searching: "Mencari",
    empty: "Tidak ada hasil. Coba nama desa lain, atau geser peta ke lahan Anda.",
    failed: "Pencarian gagal. Coba lagi sebentar lagi.",
    results: "Hasil pencarian",
  },
  map: {
    tools: "Alat peta",
    draw: "Gambar batas lahan",
    satellite: "Satelit",
    street: "Jalan",
    switchBase: "Ganti satelit atau jalan",
    zoomIn: "Perbesar",
    zoomOut: "Perkecil",
    tileError: "Sebagian citra peta gagal dimuat. Coba lagi atau perkecil peta.",
    webglError: "Peta tidak bisa dibuka di browser ini. Aktifkan akselerasi grafis lalu muat ulang.",
  },
  land: {
    title: "Tandai lahan Anda",
    subtitle: "Tiga gerakan kecil di peta.",
    searchStep: "Cari desanya",
    searchStepHint: "atau ketik koordinat",
    drawStep: "Ketuk sudut-sudut lahan",
    drawStepHint: "ketuk titik pertama untuk menutup",
    checkStep: "Cek luasnya",
    checkStepHint: "geser titik untuk memperbaiki; klik kanan untuk menghapus",
    zoomFirst: "Perbesar peta untuk menggambar lahan.",
    drawReady: "Siap menggambar. Tekan Mulai gambar, lalu tandai sudut-sudut lahan.",
    drawing: "Ketuk sudut lahan, lalu titik pertama untuk menutup. Urungkan titik jika salah; Esc untuk batal.",
    undoPoint: "Urungkan titik",
    closeBoundary: "Klik titik pertama untuk menutup batas",
    needPoints: "Tambahkan minimal 3 titik untuk menutup batas",
    draftPoint: "Titik batas; urungkan jika salah",
    editPoint: "Geser untuk memperbaiki; klik kanan untuk menghapus",
    startDraw: "Mulai gambar",
    redraw: "Gambar ulang",
    area: "Luas lahan",
    center: "Titik tengah",
    invalid: "Batas lahan tidak boleh bersilangan. Gambar ulang batasnya.",
    next: "Lanjut isi rencana",
    yourLand: "Lahan Anda",
  },
  plan: {
    title: "Apa rencana di lahan ini?",
    subtitle: "Tiga isian. Semuanya bisa diubah lagi di layar hasil.",
    changeLand: "Ubah lahan",
    pattern: "Pola tanam biasa",
    stageCount: (n: number, max: number) => `${n} dari ${max} tahap`,
    hasPattern: "Sudah punya pola",
    noPattern: "Belum punya pola",
    noPatternNote:
      "Hasil akan menampilkan beberapa alternatif tanpa pembanding pola biasa.",
    patternHint: "Klik tanaman sesuai urutan tanam biasa. Bulan otomatis mengikuti slot kalender; hanya Bera yang durasinya bisa diubah.",
    emptyStages: "Pilih tanaman pertama dari daftar di bawah.",
    stage: (n: number) => `Tahap ${n}`,
    months: (n: number) => `${n} bulan`,
    monthsShort: (n: number) => `${n} bln`,
    choices: "Tambah tahap:",
    removeStage: (n: number) => `Hapus tahap ${n}`,
    fallowLess: "Kurangi bulan bera",
    fallowMore: "Tambah bulan bera",
    full: "Sudah enam tahap. Hapus satu tahap untuk menambah yang lain.",
    cropsLoading: "Memuat daftar tanaman",
    cropsFailed: "Daftar tanaman gagal dimuat.",
    retry: "Coba lagi",
    horizon: "Lama rencana",
    horizonUnit: "bulan",
    start: "Mulai tanam",
    year: "Tahun",
    month: "Bulan",
    water: "Sumber air",
    rainfed: "Tadah hujan",
    rainfedHint: "Air dari hujan saja",
    irrigated: "Irigasi",
    irrigatedHint: "Ada saluran irigasi",
    missing: "Lengkapi pola tanam dan sumber air untuk lanjut.",
    back: "Kembali",
    compare: "Bandingkan strategi",
  },
  ai: {
    open: "Tanya AI",
    title: "Tanya AI",
    subtitle: "Jawaban disusun AI dari data Field Shift",
    close: "Tutup Tanya AI",
    notice:
      "Pertanyaan Anda dan ringkasan lahan, tanpa koordinat, dikirim ke penyedia AI. Riwayat hilang saat tab ditutup.",
    unavailable:
      "Tanya AI belum tersambung di versi ini. Perbandingan strategi tetap bisa dipakai tanpa chat.",
  },
  results: {
    title: "Perbandingan strategi",
    body: "Estimasi berdasarkan pola iklim historis untuk lahan dan rencana Anda.",
    back: "Kembali ke rencana",
  },
};

export type Dictionary = typeof id;

const en: Dictionary = {
  appName: "Field Shift",
  steps: { label: "Steps", land: "Pick your field", plan: "Fill in the plan", results: "See results" },
  stepOf: (n) => `Step ${n}/2`,
  language: "Language",
  search: {
    label: "Search a village or coordinates",
    placeholder: "Search a village, or type lat, lon",
    submit: "Search",
    searching: "Searching",
    empty: "No results. Try another village name, or pan the map to your field.",
    failed: "Search failed. Please try again shortly.",
    results: "Search results",
  },
  map: {
    tools: "Map tools",
    draw: "Draw field boundary",
    satellite: "Satellite",
    street: "Street",
    switchBase: "Switch satellite or street",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    tileError: "Some map imagery failed to load. Retry or zoom out.",
    webglError: "The map cannot open in this browser. Turn on hardware acceleration and reload.",
  },
  land: {
    title: "Mark your field",
    subtitle: "Three small steps on the map.",
    searchStep: "Find the village",
    searchStepHint: "or type coordinates",
    drawStep: "Tap the field corners",
    drawStepHint: "tap the first point to close",
    checkStep: "Check the size",
    checkStepHint: "drag a point to adjust; right-click to delete",
    zoomFirst: "Zoom in to draw your field.",
    drawReady: "Ready to draw. Press Start drawing, then mark the field corners.",
    drawing: "Tap each corner, then the first point to close. Undo a point to correct it; Esc to cancel.",
    undoPoint: "Undo point",
    closeBoundary: "Click the first point to close the boundary",
    needPoints: "Add at least 3 points to close the boundary",
    draftPoint: "Boundary point; undo to correct it",
    editPoint: "Drag to adjust; right-click to delete",
    startDraw: "Start drawing",
    redraw: "Draw again",
    area: "Field size",
    center: "Center point",
    invalid: "The boundary must not cross itself. Please draw it again.",
    next: "Continue to the plan",
    yourLand: "Your field",
  },
  plan: {
    title: "What is the plan for this field?",
    subtitle: "Three inputs. You can change all of them on the results screen.",
    changeLand: "Change field",
    pattern: "Usual cropping pattern",
    stageCount: (n, max) => `${n} of ${max} stages`,
    hasPattern: "I have a pattern",
    noPattern: "No pattern yet",
    noPatternNote: "Results will show several alternatives without a usual-pattern baseline.",
    patternHint: "Add crops in your usual planting order. Months use fixed calendar slots; only the fallow duration can be changed.",
    emptyStages: "Pick the first crop from the list below.",
    stage: (n) => `Stage ${n}`,
    months: (n) => `${n} ${n === 1 ? "month" : "months"}`,
    monthsShort: (n) => `${n} mo`,
    choices: "Add a stage:",
    removeStage: (n) => `Remove stage ${n}`,
    fallowLess: "Fewer fallow months",
    fallowMore: "More fallow months",
    full: "Six stages reached. Remove one to add another.",
    cropsLoading: "Loading crop list",
    cropsFailed: "The crop list could not be loaded.",
    retry: "Try again",
    horizon: "Plan length",
    horizonUnit: "months",
    start: "Planting starts",
    year: "Year",
    month: "Month",
    water: "Water source",
    rainfed: "Rainfed",
    rainfedHint: "Water from rain only",
    irrigated: "Irrigated",
    irrigatedHint: "An irrigation channel is available",
    missing: "Complete the cropping pattern and water source to continue.",
    back: "Back",
    compare: "Compare strategies",
  },
  ai: {
    open: "Ask AI",
    title: "Ask AI",
    subtitle: "Answers written by AI from Field Shift data",
    close: "Close Ask AI",
    notice:
      "Your question and a field summary, without coordinates, are sent to an AI provider. History is lost when the tab closes.",
    unavailable:
      "Ask AI is not connected in this version. Strategy comparison still works without chat.",
  },
  results: {
    title: "Strategy comparison",
    body: "An estimate based on historical climate patterns for your field and plan.",
    back: "Back to the plan",
  },
};

const dictionaries: Record<Lang, Dictionary> = { id, en };

export function dictionary(lang: Lang): Dictionary {
  return dictionaries[lang];
}

const locales: Record<Lang, string> = { id: "id-ID", en: "en-GB" };

export function formatMonth(month: string, lang: Lang, style: "long" | "short" = "long") {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locales[lang], {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, index - 1, 1)));
}

export function formatHectares(hectares: number, lang: Lang) {
  return new Intl.NumberFormat(locales[lang], {
    maximumFractionDigits: hectares < 10 ? 2 : 1,
  }).format(hectares);
}

export function formatCenter([lon, lat]: [number, number], lang: Lang) {
  const number = new Intl.NumberFormat(locales[lang], {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
  const ns = lat < 0 ? (lang === "id" ? "LS" : "S") : lang === "id" ? "LU" : "N";
  const ew = lon < 0 ? (lang === "id" ? "BB" : "W") : lang === "id" ? "BT" : "E";
  return `${number.format(Math.abs(lat))}° ${ns} · ${number.format(Math.abs(lon))}° ${ew}`;
}
