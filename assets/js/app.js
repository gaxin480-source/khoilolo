window.APP_LIBRARY_FILES = [
  "data/anime/yosuga-no-sora.json"
];

window.StreamUI = (function () {
  function getQueryParam(name, fallback = "") {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || fallback;
  }

  function buildUrl(page, params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });

    const queryString = query.toString();
    return queryString ? `${page}?${queryString}` : page;
  }

  async function loadLibrary() {
    const files = window.APP_LIBRARY_FILES || [];

    const library = await Promise.all(
      files.map(async (path) => {
        try {
          const response = await fetch(path, { cache: "no-store" });
          if (!response.ok) throw new Error(`Failed to load ${path}`);
          return await response.json();
        } catch (error) {
          console.error(error);
          return null;
        }
      })
    );

    return library.filter(Boolean);
  }

  async function getAnimeBySlug(slug) {
    const library = await loadLibrary();
    return library.find((item) => item.slug === slug) || library[0] || null;
  }

  function getFirstEpisode(anime) {
    const firstSeason = anime?.seasons?.[0];
    const firstEpisode = firstSeason?.episodes?.[0];

    if (!firstSeason || !firstEpisode) return null;

    return {
      season: firstSeason.seasonNumber,
      episode: firstEpisode.number,
      data: firstEpisode
    };
  }

  function flattenEpisodes(anime) {
    if (!anime?.seasons?.length) return [];

    let absIndex = 1;

    return anime.seasons.flatMap((season) =>
      season.episodes.map((episode) => ({
        ...episode,
        seasonNumber: season.seasonNumber,
        seasonTitle: season.title || `Season ${season.seasonNumber}`,
        absoluteIndex: absIndex++
      }))
    );
  }

  function getEpisode(anime, seasonNumber, episodeNumber) {
    const season = anime?.seasons?.find((item) => Number(item.seasonNumber) === Number(seasonNumber));
    if (!season) return null;

    const episode = season.episodes.find((item) => Number(item.number) === Number(episodeNumber));
    if (!episode) return null;

    return {
      season,
      episode
    };
  }

  function detailHref(anime) {
    return buildUrl("detail.html", { slug: anime.slug });
  }

  function watchHref(anime, season, episode) {
    return buildUrl("watch.html", {
      slug: anime.slug,
      season,
      episode
    });
  }

  function setMeta(title, description) {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) {
      meta.setAttribute("content", description);
    }
  }

  function genresLine(genres = []) {
    return genres.join(" • ");
  }

  function formatEpisodeLabel(season, episode) {
    return `S${String(season).padStart(2, "0")} · E${String(episode).padStart(2, "0")}`;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  return {
    getQueryParam,
    buildUrl,
    loadLibrary,
    getAnimeBySlug,
    getFirstEpisode,
    flattenEpisodes,
    getEpisode,
    detailHref,
    watchHref,
    setMeta,
    genresLine,
    formatEpisodeLabel,
    escapeHtml
  };
})();