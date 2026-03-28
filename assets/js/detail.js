document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("detailApp");
  const slug = window.StreamUI.getQueryParam("slug");
  const anime = await window.StreamUI.getAnimeBySlug(slug);

  if (!anime) {
    app.innerHTML = `<div class="container"><div class="empty-state">Title unavailable.</div></div>`;
    return;
  }

  const requestedSeason = Number(window.StreamUI.getQueryParam("season", anime.seasons?.[0]?.seasonNumber || 1));
  let activeSeason = anime.seasons.find((season) => Number(season.seasonNumber) === requestedSeason) || anime.seasons[0];

  window.StreamUI.setMeta(`${anime.title} · KageStream`, anime.description);

  render();

  function render() {
    const firstEpisode = window.StreamUI.getFirstEpisode(anime);
    const watchState = window.StreamStorage.getWatchState(anime.slug);
    const resumeHref = watchState
      ? window.StreamUI.watchHref(anime, watchState.season, watchState.episode)
      : firstEpisode
        ? window.StreamUI.watchHref(anime, firstEpisode.season, firstEpisode.episode)
        : "#";

    app.innerHTML = `
      <div class="container">
        <section
          class="detail-banner"
          style="background-image:
            linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18)),
            url('${anime.cover}')"
        >
          <div class="detail-layout">
            <div class="detail-poster">
              <img src="${anime.poster}" alt="${window.StreamUI.escapeHtml(anime.title)} poster" />
            </div>

            <div class="detail-copy">
              <div class="pill-row">
                <span class="pill">${anime.year}</span>
                <span class="pill">${anime.episodes} Episodes</span>
                ${(anime.genres || []).map((genre) => `<span class="pill">${window.StreamUI.escapeHtml(genre)}</span>`).join("")}
              </div>

              <h1 class="detail-title">${window.StreamUI.escapeHtml(anime.title)}</h1>
              <p class="detail-description">${window.StreamUI.escapeHtml(anime.description)}</p>

              <div class="detail-actions">
                <a class="btn btn-primary" href="${resumeHref}">
                  ${watchState ? "Continue Watching" : "Start Watching"}
                </a>
                <a class="btn btn-secondary" href="index.html">Back to Home</a>
              </div>
            </div>
          </div>
        </section>

        <section class="detail-content">
          <div class="content-card">
            <h3>Episodes</h3>

            <div class="season-tabs" id="seasonTabs">
              ${anime.seasons.map((season) => `
                <button
                  class="season-tab ${Number(season.seasonNumber) === Number(activeSeason.seasonNumber) ? "is-active" : ""}"
                  data-season="${season.seasonNumber}"
                  type="button"
                >
                  ${window.StreamUI.escapeHtml(season.title || `Season ${season.seasonNumber}`)}
                </button>
              `).join("")}
            </div>

            <div class="episode-grid">
              ${activeSeason.episodes.map((episode) => {
                const progress = window.StreamStorage.getProgress(anime.slug, activeSeason.seasonNumber, episode.number);

                return `
                  <article class="episode-card">
                    <div class="episode-top">
                      <span>${window.StreamUI.formatEpisodeLabel(activeSeason.seasonNumber, episode.number)}</span>
                      <span>${window.StreamUI.escapeHtml(episode.duration || "")}</span>
                    </div>

                    <h4>${window.StreamUI.escapeHtml(episode.title)}</h4>
                    <p>${window.StreamUI.escapeHtml(episode.description)}</p>

                    ${
                      progress
                        ? `
                          <div class="progress-bar" style="margin-bottom:14px;">
                            <span style="width:${progress.percent || 0}%"></span>
                          </div>
                        `
                        : ""
                    }

                    <div class="episode-card-footer">
                      <span class="pill">${progress ? `${progress.percent || 0}% watched` : "Ready to play"}</span>
                      <a
                        class="btn btn-primary"
                        href="${window.StreamUI.watchHref(anime, activeSeason.seasonNumber, episode.number)}"
                      >
                        Play
                      </a>
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          </div>

          <aside class="detail-sidebar">
            <div class="content-card">
              <h3>Overview</h3>
              <div class="stat-list">
                <div class="stat-item">
                  <small>Title</small>
                  <strong>${window.StreamUI.escapeHtml(anime.title)}</strong>
                </div>
                <div class="stat-item">
                  <small>Genres</small>
                  <strong>${window.StreamUI.escapeHtml(window.StreamUI.genresLine(anime.genres))}</strong>
                </div>
                <div class="stat-item">
                  <small>Season Count</small>
                  <strong>${anime.seasons.length}</strong>
                </div>
                <div class="stat-item">
                  <small>Release Year</small>
                  <strong>${anime.year}</strong>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    `;

    bindSeasonTabs();
  }

  function bindSeasonTabs() {
    const tabs = app.querySelectorAll(".season-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const seasonNumber = Number(tab.dataset.season);
        const nextSeason = anime.seasons.find((season) => Number(season.seasonNumber) === seasonNumber);

        if (nextSeason) {
          activeSeason = nextSeason;
          history.replaceState({}, "", window.StreamUI.buildUrl("detail.html", {
            slug: anime.slug,
            season: activeSeason.seasonNumber
          }));
          render();
        }
      });
    });
  }
});
