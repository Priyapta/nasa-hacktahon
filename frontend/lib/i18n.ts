import type { Lang } from "./types";

const id = {
  appName: "Field Shift",
  steps: { label: "Langkah", land: "Pilih lahan", plan: "Isi rencana", results: "Lihat hasil" },
  stepOf: (n: number) => `Langkah ${n}/2`,
  language: "Bahasa",
  disclaimer:
    "Alat ini membantu membandingkan pilihan. Keputusan tetap di tangan Anda dan penyuluh setempat.",
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
    checkStepHint: "geser titik kalau batasnya meleset",
    zoomFirst: "Perbesar peta sampai petak sawah terlihat untuk mulai menggambar.",
    drawing: "Ketuk sudut lahan satu per satu. Tekan Esc untuk batal.",
    startDraw: "Mulai gambar",
    redraw: "Gambar ulang",
    area: "Luas lahan",
    center: "Titik tengah",
    invalid: "Batas lahan tidak boleh bersilangan. Gambar ulang batasnya.",
    climateNote: "Data iklim dibaca untuk area sekitar lahan, bukan pengukuran tepat di petak.",
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
    emptyStages: "Pilih tanaman pertama dari daftar di bawah.",
    stage: (n: number) => `Tahap ${n}`,
    months: (n: number) => `${n} bulan`,
    monthsShort: (n: number) => `${n} bln`,
    choices: "Tambah tahap:",
    removeStage: (n: number) => `Hapus tahap ${n}`,
    fallowLess: "Kurangi bulan bera",
    fallowMore: "Tambah bulan bera",
    full: "Sudah enam tahap. Hapus satu tahap untuk menambah yang lain.",
    patternNote:
      "Rencana dihitung mulai saat lahan siap ditanami pada bulan mulai. Pola biasa Anda diulang dari tahap pertama.",
    cropsLoading: "Memuat daftar tanaman",
    cropsFailed: "Daftar tanaman gagal dimuat.",
    retry: "Coba lagi",
    horizon: "Lama rencana",
    horizonUnit: "bulan",
    start: "Mulai tanam",
    until: (month: string) => `Bisa digeser sampai ${month}`,
    prevMonth: "Bulan sebelumnya",
    nextMonth: "Bulan berikutnya",
    water: "Sumber air",
    rainfed: "Tadah hujan",
    rainfedHint: "Air dari hujan saja",
    irrigated: "Irigasi",
    irrigatedHint: "Ada saluran irigasi",
    waterNote: "Irigasi dianggap tersedia, jumlah airnya tidak dihitung.",
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
    title: "Layar hasil sedang dibuat",
    body: "Isian Anda sudah tersimpan di alamat halaman ini. Perbandingan strategi akan tampil di sini setelah analisis tersambung.",
    back: "Kembali ke rencana",
  },
};

export type Dictionary = typeof id;

const en: Dictionary = {
  appName: "Field Shift",
  steps: { label: "Steps", land: "Pick your field", plan: "Fill in the plan", results: "See results" },
  stepOf: (n) => `Step ${n}/2`,
  language: "Language",
  disclaimer:
    "This tool helps you compare options. The decision stays with you and your local extension officer.",
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
    checkStepHint: "drag a point if the edge is off",
    zoomFirst: "Zoom in until the rice plots are visible to start drawing.",
    drawing: "Tap the field corners one by one. Press Esc to cancel.",
    startDraw: "Start drawing",
    redraw: "Draw again",
    area: "Field size",
    center: "Center point",
    invalid: "The boundary must not cross itself. Please draw it again.",
    climateNote: "Climate data describes the area around the field, not a measurement on the plot.",
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
    emptyStages: "Pick the first crop from the list below.",
    stage: (n) => `Stage ${n}`,
    months: (n) => `${n} ${n === 1 ? "month" : "months"}`,
    monthsShort: (n) => `${n} mo`,
    choices: "Add a stage:",
    removeStage: (n) => `Remove stage ${n}`,
    fallowLess: "Fewer fallow months",
    fallowMore: "More fallow months",
    full: "Six stages reached. Remove one to add another.",
    patternNote:
      "The plan starts when the field is ready to plant in the start month. Your usual pattern repeats from the first stage.",
    cropsLoading: "Loading crop list",
    cropsFailed: "The crop list could not be loaded.",
    retry: "Try again",
    horizon: "Plan length",
    horizonUnit: "months",
    start: "Planting starts",
    until: (month) => `Can move up to ${month}`,
    prevMonth: "Previous month",
    nextMonth: "Next month",
    water: "Water source",
    rainfed: "Rainfed",
    rainfedHint: "Water from rain only",
    irrigated: "Irrigated",
    irrigatedHint: "An irrigation channel is available",
    waterNote: "Irrigation is assumed available. The amount of water is not calculated.",
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
    title: "The results screen is being built",
    body: "Your inputs are saved in this page address. The strategy comparison will appear here once analysis is connected.",
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
