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

// ─── Config page ────────────────────────────────────────────────────────────

let configSaveTimer = null;

function showConfig() {
  document.getElementById('main').style.display = 'none';
  document.getElementById('config-page').style.display = 'flex';
  document.getElementById('config-textarea').value = localStorage.getItem('backlog') || '';
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

// ─── Dictionary fetchers ────────────────────────────────────────────────────

function loadTranslations(word, onNewEntry, onLoaded) {
  const fetchers = { udew, dict, multitran, wiki };
  const loaded = {};
  for (const [name, fn] of Object.entries(fetchers)) {
    loaded[name] = false;
    fn(word, onNewEntry, () => {
      loaded[name] = true;
      if (Object.values(loaded).every(Boolean)) onLoaded();
    });
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

function udew(word, onNewEntry, onLoaded) {
  const loaded = {};

  function parse(html) {
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
      doc.querySelectorAll('#mycol-center table').forEach(t => {
        dictTable2Entries(t).forEach(onNewEntry);
      });
    })
    .finally(() => onLoaded());
}

function dictTable2Entries(doc) {
  const results = [];
  const source = 'dict.com';

  const headRow = doc.querySelector('tr.head');
  if (headRow) {
    const germanSpan = headRow.querySelector('.lex_ful_entr.l1');
    const morphSpan = headRow.querySelector('.lex_ful_morf');
    if (germanSpan) {
      let germanWord = germanSpan.textContent.trim();
      let morph = morphSpan ? morphSpan.textContent.trim() : '';
      if (morph === 'm') morph = '{m}';
      else if (morph) morph = `{${morph}}`;

      const tranSpan = doc.querySelector('.lex_ful_tran.w.l2');
      if (tranSpan) {
        tranSpan.innerHTML.split(/\s*,\s*/).forEach(part => {
          let ukText = part.replace(/<span class="lex_ful_g">m<\/span>/g, '{ч}').replace(/<[^>]*>/g, '').trim();
          results.push({ de: morph ? `${germanWord} ${morph}`.trim() : germanWord, uk: ukText, source });
        });
      }
    }
  }

  doc.querySelectorAll('.lex_ful_coll2').forEach(coll2 => {
    const germanPhrase = coll2.querySelector('.lex_ful_coll2s.w.l1');
    const ukrPhrase = coll2.querySelector('.lex_ful_coll2t.w.l2');
    if (germanPhrase && ukrPhrase) {
      const gerText = germanPhrase.textContent.trim();
      ukrPhrase.innerHTML.split(/\s*,\s*/).forEach(fragment => {
        const ukText = fragment.replace(/<span class="lex_ful_g">m<\/span>/g, '{ч}').replace(/<[^>]*>/g, '').trim();
        results.push({ de: gerText, uk: ukText, source });
      });
    }
  });

  return results;
}

function multitran(word, onNewEntry, onLoaded) {
  getPage('https://www.multitran.com/m.exe?ll1=3&ll2=33&s=%s&l2=33', word)
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('table').forEach(t => {
        if (t.innerHTML.includes('gif/logoe.gif')) return;
        parseMultitranHTML(t).forEach(onNewEntry);
      });
    })
    .finally(() => onLoaded());
}

function parseMultitranHTML(doc) {
  const source = 'multitran';
  const results = [];
  const allRows = Array.from(doc.querySelectorAll('tr'));
  let currentGerman = '', currentPron = '', currentMorph = '';

  function parseGermanRow(row) {
    const germanCell = row.querySelector('td.orig11 table td[valign="top"]');
    if (!germanCell) return { germanWord: '', morph: '', pron: '' };
    const linkEl = germanCell.querySelector('a[href*="m.exe"]');
    const pronSpan = germanCell.querySelector('span[style*="color:gray"]');
    const morphSpan = germanCell.querySelector('em span[style*="color:gray"]');
    return {
      germanWord: linkEl ? linkEl.textContent.trim() : '',
      pron: pronSpan ? pronSpan.textContent.trim() : '',
      morph: morphSpan ? morphSpan.textContent.trim() : '',
    };
  }

  function buildGermanString(word, pron, morph) {
    let morphClean = morph;
    if (morphClean.startsWith('m')) morphClean = '{m} ' + morphClean.substring(1).trim();
    else if (morphClean) morphClean = `{${morphClean}}`;
    const parts = [];
    if (word) parts.push(word);
    if (morphClean) parts.push(morphClean);
    if (pron) parts.push(`[${pron.replace(/\[|\]/g, '')}]`);
    return parts.join(' ');
  }

  allRows.forEach(row => {
    if (row.querySelector('td.orig11')) {
      const { germanWord, pron, morph } = parseGermanRow(row);
      currentGerman = germanWord; currentPron = pron; currentMorph = morph;
      return;
    }
    const subjTd = row.querySelector('td.subj');
    const transTd = row.querySelector('td.trans');
    if (subjTd && transTd) {
      let ukText = transTd.textContent.trim().replace(/\bm\b/g, '{m}');
      results.push({ de: buildGermanString(currentGerman, currentPron, currentMorph).trim(), uk: ukText, source });
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
