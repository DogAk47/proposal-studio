const paths = {
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/>',
  columns:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M9 5v14m6-14v14"/>',
  plug:'<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-6 6v4m-6-10v-3"/>',
  graduation:'<path d="m3 9 9-4 9 4-9 4zM7 11v5c2 3 8 3 10 0v-5m4-2v5"/>',
  flask:'<path d="M9 3h6m-5 0v7L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 16h8"/>',
  spark:'<path d="M12 3c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9Z"/>',
  briefcase:'<rect x="3.5" y="7" width="17" height="13" rx="2"/><path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M4 11c4 4 12 4 16 0m-8 2v3"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  left:'<path d="m15 6-6 6 6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  expand:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
  download:'<path d="M12 4v11m-4-4 4 4 4-4M5 16v4h14v-4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clipboard:'<rect x="6" y="5" width="13" height="16" rx="2"/><rect x="9" y="3" width="7" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  image:'<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.2"/><path d="m4 17 5-4 3 2 4-4 4 5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  external:'<path d="M13 5h6v6m0-6-8 8m6 0v6H5V7h6"/>',
};

export function icon(name,size=19) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.file}</svg>`;
}
