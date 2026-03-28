(function () {
  const PROGRESS_KEY = "kagestream_progress_v1";
  const WATCH_STATE_KEY = "kagestream_watch_state_v1";
  const SETTINGS_KEY = "kagestream_settings_v1";

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function makeEpisodeId(slug, season, episode) {
    return `${slug}::s${String(season).padStart(2, "0")}::e${String(episode).padStart(2, "0")}`;
  }

  const StorageAPI = {
    getProgress(slug, season, episode) {
      const store = readJson(PROGRESS_KEY, {});
      return store[makeEpisodeId(slug, season, episode)] || null;
    },

    saveProgress({ slug, season, episode, currentTime, duration, completed }) {
      const store = readJson(PROGRESS_KEY, {});
      const id = makeEpisodeId(slug, season, episode);

      store[id] = {
        slug,
        season,
        episode,
        currentTime: Number(currentTime || 0),
        duration: Number(duration || 0),
        percent: duration ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0,
        completed: Boolean(completed),
        updatedAt: Date.now()
      };

      writeJson(PROGRESS_KEY, store);
    },

    getAllProgress() {
      return readJson(PROGRESS_KEY, {});
    },

    getWatchState(slug) {
      const store = readJson(WATCH_STATE_KEY, {});
      return store[slug] || null;
    },

    saveWatchState(slug, season, episode) {
      const store = readJson(WATCH_STATE_KEY, {});
      store[slug] = {
        season,
        episode,
        updatedAt: Date.now()
      };
      writeJson(WATCH_STATE_KEY, store);
    },

    getSettings() {
      return readJson(SETTINGS_KEY, {
        autoplayNext: true
      });
    },

    saveSettings(patch) {
      const current = StorageAPI.getSettings();
      writeJson(SETTINGS_KEY, { ...current, ...patch });
    }
  };

  window.StreamStorage = StorageAPI;
})();
