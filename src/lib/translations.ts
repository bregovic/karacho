export type Locale = 'cs' | 'en';

export const translations = {
  cs: {
    admin_title: "Administrace & Písně",
    admin_subtitle: "Kompletní řízení životního cyklu karaoke.",
    add_song: "Přidat novu píseň",
    close_panel: "Zavřít panel",
    search_placeholder: "Hledat podle názvu nebo interpreta...",
    all_genres: "Všechny žánry",
    all_tags: "Všechny štítky",
    all_status: "Všechny stavy",
    status_audio: "Čeká na Audio",
    status_timing: "Čeká na Studio",
    status_render: "Čeká na Render",
    status_done: "Hotovo",
    delete_confirm: "Opravdu smazat píseň?",
    delete_btn: "Smazat",
    play_karaoke: "Přehrát Karaoke",
    open_studio: "Otevřít ve Studiu",
    send_render: "Renderovat Video",
    step_audio: "1. Audio stopa",
    step_studio: "2. Časování (Studio)",
    step_render: "3. Video Export",
  },
  en: {
    admin_title: "Admin & Songs",
    admin_subtitle: "Complete management of karaoke lifecycle.",
    add_song: "Add new song",
    close_panel: "Close panel",
    search_placeholder: "Search by title or artist...",
    all_genres: "All genres",
    all_tags: "All tags",
    all_status: "All statuses",
    status_audio: "Waiting for Audio",
    status_timing: "Waiting for Studio",
    status_render: "Waiting for Render",
    status_done: "Done",
    delete_confirm: "Are you sure you want to delete this song?",
    delete_btn: "Delete",
    play_karaoke: "Play Karaoke",
    open_studio: "Open Studio",
    send_render: "Render Video",
    step_audio: "1. Audio Track",
    step_studio: "2. Timing (Studio)",
    step_render: "3. Video Export",
  }
};

export const useTranslation = (lang: Locale = 'cs') => {
  return (key: keyof typeof translations['cs']) => {
    return translations[lang][key] || translations['cs'][key];
  };
};
