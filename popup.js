// ─── Routing ────────────────────────────────────────────────────────────────

let currentWord = '';

function navigate(path) {
  location.hash = path;
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);

function render() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'config') {
    showConfig();
  } else {
    const word = hash.startsWith('search/') ? decodeURIComponent(hash.slice(7)) : '';
    showSearch(word);
  }
}

// ─── Search page ────────────────────────────────────────────────────────────

function showSearch(word) {
  document.getElementById('main').style.display = 'flex';
  document.getElementById('config-page').style.display = 'none';

  const input = document.getElementById('search-input');
  if (input.value !== word) input.value = word;

  renderBacklog();

  if (word !== currentWord) {
    currentWord = word;
    document.getElementById('translations-body').innerHTML = '';
    document.getElementById('loading-msg').style.display = word ? 'block' : 'none';
    document.getElementById('dictcc-frame').src = word
      ? `https://deuk.dict.cc/?s=${encodeURIComponent(word)}`
      : 'about:blank';

    if (word) {
      loadTranslations(word, addTranslationRow, () => {
        document.getElementById('loading-msg').style.display = 'none';
      });
    }
  }
}

function addTranslationRow(entry) {
  const tbody = document.getElementById('translations-body');
  const tr = document.createElement('tr');

  const tdDe = document.createElement('td');
  tdDe.innerHTML = entry.de;
  const tdUk = document.createElement('td');
  tdUk.innerHTML = entry.uk || '';
  const tdSrc = document.createElement('td');
  tdSrc.textContent = entry.source;
  tdSrc.style.cursor = 'pointer';
  tdSrc.addEventListener('click', () => {
    navigator.clipboard.writeText(entry.source);
  });

  tr.appendChild(tdDe);
  tr.appendChild(tdUk);
  tr.appendChild(tdSrc);
  tbody.appendChild(tr);
}

// ─── Backlog panel ──────────────────────────────────────────────────────────

function renderBacklog() {
  const list = document.getElementById('backlog-list');
  list.innerHTML = '';
  const words = (localStorage.getItem('backlog') || '').split('\n').filter(Boolean);
  words.forEach(word => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#search/${encodeURIComponent(word)}`;
    a.textContent = word;
    li.appendChild(a);
    list.appendChild(li);
  });
}



document.getElementById('edit-link').addEventListener('click', (e) => {
  e.preventDefault();
  navigate('config');
});

document.getElementById('linguisto').addEventListener('click', (e) => {
    navigator.clipboard.writeText(
      'https://github.com/vlddev/linguisto-dicts/blob/master/linguisto_de_uk.xml.zip'
    );
});

// ─── Config page ────────────────────────────────────────────────────────────

let configSaveTimer = null;

function showConfig() {
  document.getElementById('main').style.display = 'none';
  document.getElementById('config-page').style.display = 'flex';
  document.getElementById('config-textarea').value = localStorage.getItem('backlog') || '';
  document.getElementById('deepl-key-input').value = localStorage.getItem('deeplAuthKey') || '';
}

document.getElementById('config-back-link').addEventListener('click', (e) => {
  e.preventDefault();
  navigate('search/');
});

document.getElementById('config-textarea').addEventListener('input', (e) => {
  clearTimeout(configSaveTimer);
  configSaveTimer = setTimeout(() => {
    const cleaned = e.target.value
      .split('\n')
      .map(line => line.replace(/\{\w\}/g, '').replace(/\[[^\]]+\]/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');
    localStorage.setItem('backlog', cleaned);
  }, 500);
});

document.getElementById('deepl-key-input').addEventListener('input', (e) => {
  localStorage.setItem('deeplAuthKey', e.target.value);
});

// ─── Search input ───────────────────────────────────────────────────────────

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const word = e.target.value.trim();
    if (!word) return;
    currentWord = ''; // force reload even if same word typed again
    location.hash = `search/${encodeURIComponent(word)}`;
    // hashchange won't fire if hash didn't change, so call directly
    showSearch(word);
  }
});

// ─── External searches ──────────────────────────────────────────────────────

document.querySelectorAll('#external-searches button').forEach(btn => {
  btn.addEventListener('click', () => {
    const word = document.getElementById('search-input').value.trim();
    if (!word) return;
    window.open(btn.dataset.searchUrl.replace('%s', encodeURIComponent(word)), '_blank');
  });
});

// ─── Dictionary fetchers ────────────────────────────────────────────────────

function loadTranslations(word, onNewEntry, onLoaded) {
  const fetchers = { udew, dict, multitran, wiki, deepl };
  const loaded = {};
  for (const [name, fn] of Object.entries(fetchers)) {
    loaded[name] = false;
    fn(word, onNewEntry, () => {
      loaded[name] = true;
      if (Object.values(loaded).every(Boolean)) onLoaded();
    });
  }
}

async function deepl(word, onNewEntry, onLoaded) {
  const authKey = localStorage.getItem('deeplAuthKey');
  if (!authKey) {
    onLoaded();
    return;
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': 'DeepL-Auth-Key ' + authKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [word],
        target_lang: 'UK',
        source_lang: 'DE'
      })
    });

    if (!response.ok) {
      console.error('DeepL request failed:', response.status);
      onLoaded();
      return;
    }

    const data = await response.json();
    if (data.translations && data.translations.length > 0) {
      onNewEntry({
        de: word,
        uk: data.translations[0].text,
        source: 'deepl'
      });
    }
  } catch (error) {
    console.error('DeepL error:', error);
  } finally {
    onLoaded();
  }
}

async function getPage(dictURL, word) {
  const url = dictURL.replace('%s', encodeURIComponent(word));
  const resp = await fetch(url, { cache: 'force-cache' });
  if (!resp.ok) throw new Error('Request failed: ' + resp.status);
  return resp.text();
}

function cleanupHTML(html) {
  return html.replace(/<[^>]*>/g, '');
}

function furtherOccurences(html) {
  return html.replace(/<a href="([^"]*)"[^>]*>.*<\/a>/, 'https://udew.uni-leipzig.de$1');
}

// udew rejects the rest of the day's requests once the quota is exceeded;
// back off for 8 hours instead of firing requests into the block.
const UDEW_BLOCK_MS = 8 * 60 * 60 * 1000;

function udewIsBlocked() {
  return Date.now() < Number(localStorage.getItem('udewBlockedUntil') || 0);
}

function udew(word, onNewEntry, onLoaded) {
  if (udewIsBlocked()) {
    onNewEntry({ de: 'ліміт', uk: '', source: 'udew' });
    onLoaded();
    return;
  }

  const loaded = {};

  function parse(html) {
    if (html.includes('Добовий ліміт')) {
      localStorage.setItem('udewBlockedUntil', String(Date.now() + UDEW_BLOCK_MS));
      onNewEntry({ de: 'ліміт', uk: '', source: 'udew' });
      return;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('main > p').forEach(p => {
      const paragraph = p.innerHTML;
      if (paragraph.includes('mailto:') || paragraph.includes('vorangehende Belege')) return;
      if (paragraph.includes('show further occurences')) {
        const url = furtherOccurences(paragraph);
        loaded[url] = false;
        getPage(url, '%s')
          .then(parse)
          .finally(() => {
            loaded[url] = true;
            if (Object.values(loaded).every(Boolean)) onLoaded();
          });
        return;
      }
      const lines = paragraph.split('<br>');
      if (lines.length !== 2) { console.error('udew: unexpected lines:', lines); return; }
      onNewEntry({ de: cleanupHTML(lines[1]), uk: cleanupHTML(lines[0]), source: 'udew' });
    });
  }

  const url = 'https://udew.uni-leipzig.de/udew/uk/ukrainisch_deutsch_online.htm?input=%s';
  loaded[url] = false;
  getPage(url, word)
    .then(parse)
    .finally(() => {
      loaded[url] = true;
      if (Object.values(loaded).every(Boolean)) onLoaded();
    });
}

function dict(word, onNewEntry, onLoaded) {
  getPage('https://dict.com/ukrainisch-deutsch/%s', word)
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      dictPage2Entries(doc).forEach(onNewEntry);
    })
    .finally(onLoaded);
}

// dict.com entry page: headword in #entry-header, POS info in #entry-rest,
// then senses with translations (lex_ful_tran), phrase pairs (lex_ful_coll2)
// and example sentences (lex_ful_samp2). The fulltext-search hits
// (lex_ftx_*) are ignored: they are reverse matches, not translations.
function dictPage2Entries(doc) {
  const results = [];
  const source = 'dict.com';

  let containers = Array.from(doc.querySelectorAll('#entry-body'));
  if (containers.length === 0) {
    containers = Array.from(doc.querySelectorAll('section.main-body'));
  }

  containers.forEach(entry => {
    const entrEl = entry.querySelector('[class*="lex_ful_entr"]');
    if (!entrEl) return;
    const germanWord = entrEl.textContent.trim();
    const morphEl = entry.querySelector('[class*="lex_ful_morf"]');
    const de = [germanWord, dictMorphTag(morphEl)].filter(Boolean).join(' ');

    entry.querySelectorAll('[class*="lex_ful_tran"]').forEach(tran => {
      tran.textContent.split(/\s*,\s*/).forEach(part => {
        const ukText = dictCleanUk(part);
        if (ukText) results.push({ de, uk: ukText, source });
      });
    });

    entry.querySelectorAll('[class*="lex_ful_coll2s"]').forEach(collS => {
      const collT = collS.parentElement.querySelector('[class*="lex_ful_coll2t"]');
      if (!collT) return;
      collT.textContent.split(/\s*,\s*/).forEach(part => {
        const ukText = dictCleanUk(part);
        if (ukText) results.push({ de: collS.textContent.trim(), uk: ukText, source });
      });
    });

    entry.querySelectorAll('[class*="lex_ful_samp2s"]').forEach(sampS => {
      const sampT = sampS.parentElement.querySelector('[class*="lex_ful_samp2t"]');
      if (!sampT) return;
      const ukText = dictCleanUk(sampT.textContent);
      if (ukText) results.push({ de: sampS.textContent.trim(), uk: ukText, source });
    });
  });

  return results;
}

// "Substantiv, Neutrum" -> "{n}", "Substantiv, Maskulin" -> "{m}", etc.
function dictMorphTag(morphEl) {
  const morph = morphEl ? morphEl.textContent.trim() : '';
  if (/Substantiv/.test(morph)) {
    if (/Neutrum/.test(morph)) return '{n}';
    if (/Feminin/.test(morph)) return '{f}';
    if (/Maskulin/.test(morph)) return '{m}';
  }
  return '';
}

function dictCleanUk(text) {
  return text.replace(/\bm\b/g, '{ч}').trim();
}

function multitran(word, onNewEntry, onLoaded) {
  getPage('https://www.multitran.com/m.exe?ll1=3&ll2=33&s=%s&l2=33', word)
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      parseMultitranHTML(doc).forEach(onNewEntry);
    })
    .finally(onLoaded);
}

// Walks all rows in document order. A row with an original-language cell
// (class starting with "orig") starts a new headword; a row with a subject
// cell ("subj...") and a translation cell ("trans...") yields one entry.
function parseMultitranHTML(doc) {
  const results = [];
  const source = 'multitran';
  let currentGerman = '';

  function parseHeadword(headTd) {
    const linkEl = headTd.querySelector('a[href*="m.exe"]');
    const morphEl = headTd.querySelector('em');
    const morph = morphEl ? morphEl.textContent.replace(/=/g, '').trim() : '';
    let germanWord;
    if (linkEl) {
      germanWord = linkEl.textContent.trim();
    } else {
      const clone = headTd.cloneNode(true);
      const cloneEm = clone.querySelector('em');
      if (cloneEm) cloneEm.remove();
      germanWord = clone.textContent.trim();
    }
    const pronSpan = Array.from(headTd.querySelectorAll('span[style*="color:gray"]'))
      .find(span => !span.closest('em'));
    const pron = pronSpan ? pronSpan.textContent.replace(/[[\]]/g, '').trim() : '';
    const parts = [germanWord];
    if (morph) parts.push(`{${morph}}`);
    if (pron) parts.push(`[${pron}]`);
    return parts.filter(Boolean).join(' ');
  }

  doc.querySelectorAll('tr').forEach(row => {
    const headTd = row.querySelector('td[class*="orig"]');
    if (headTd) {
      currentGerman = parseHeadword(headTd);
      return;
    }
    const subjTd = row.querySelector('td[class*="subj"]');
    const transTd = row.querySelector('td[class*="trans"]');
    if (subjTd && transTd && currentGerman) {
      const ukText = transTd.textContent.trim().replace(/\bm\b/g, '{m}');
      results.push({ de: currentGerman, uk: ukText, source });
    }
  });

  return results;
}

function wiki(word, onNewEntry, onLoaded) {
  getPage('https://de.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|langlinks&lllang=uk&exintro&explaintext&redirects=1&titles=%s', word)
    .then(jsonStr => {
      const data = JSON.parse(jsonStr);
      const pages = data.query && data.query.pages;
      for (const pageId in pages) {
        const page = pages[pageId];
        const title = page.title;
        if (page.missing !== undefined) {
          onNewEntry({
            de: `not found. <a target="_blank" href="https://de.wikipedia.org/w/index.php?fulltext=1&search=${encodeURIComponent(title)}&title=Spezial%3ASuche&ns0=1">Search Wiki</a>`,
            uk: `<a target="_blank" href="https://uk.wikipedia.org/w/index.php?fulltext=1&search=${encodeURIComponent(word)}&title=%D0%A1%D0%BF%D0%B5%D1%86%D1%96%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0:%D0%9F%D0%BE%D1%88%D1%83%D0%BA&ns0=1">пошук</a>`,
            source: 'wiki'
          });
          break;
        }
        const links = page.langlinks || [];
        const entry = { de: `${title}: ${page.extract}`, source: 'wiki' };
        if (links.length === 0) { onNewEntry(entry); break; }
        const link = links[0]['*'];
        entry.uk = `<a href='https://uk.wikipedia.org/wiki/${encodeURIComponent(link)}'>${link}</a>`;
        onNewEntry(entry);
        break;
      }
    })
    .finally(() => onLoaded());
}
