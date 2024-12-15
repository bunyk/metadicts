const DictFetchers = {
    udew, dict, multitran, wiki
};

export function loadTranslations(word, onNewEntry, onLoaded) {
  const loaded = {};
  for(const [dict, fetcher] of Object.entries(DictFetchers)) {
      loaded[dict] = false;
      fetcher(word, onNewEntry, () => {
        loaded[dict] = true;
        if (Object.values(loaded).every(Boolean)) { // all loaded
          onLoaded();
        }
      });
  }
}

function udew(word, onNewEntry, onLoaded) {
  const loaded = {};
  const parse = (html) => {
      let doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('main > p').forEach(p => {
        const paragraph = p.innerHTML;
        if(paragraph.includes('mailto:') || paragraph.includes('vorangehende Belege')) return;
        if(paragraph.includes('show further occurences')) {
          const url = furtherOccurences(paragraph);
          loaded[url] = false;
          getPage(url, '%s')
            .then(parse)
            .finally(() => {
              loaded[url] = true;
              if (Object.values(loaded).every(Boolean)) { // all loaded
                onLoaded();
              }
            });
          return
        }
        const lines = paragraph.split('<br>');
        if (lines.length != 2) {
          console.error("udew: unexpected number of lines:", lines);
          return
        }
        onNewEntry({
          "de": cleanupHTML(lines[1]),
          "uk": cleanupHTML(lines[0]),
          source: "udew",
        });
      });
  }
  const url = "https://udew.uni-leipzig.de/udew/uk/ukrainisch_deutsch_online.htm?input=%s"
  loaded[url] = false;
  getPage(url, word)
    .then(parse)
    .finally(() => {
      loaded[url] = true;
      if (Object.values(loaded).every(Boolean)) { // all loaded
        onLoaded();
      }
    });
}

function furtherOccurences(html) {
  // convert <a href="/udew/uk/ukrainisch_deutsch_online.htm?input=Hund&amp;from=10&amp;cnt=10"><i>show further occurences</i></a>
  // to an url
  return html.replace(/<a href="([^"]*)"[^>]*>.*<\/a>/, "https://udew.uni-leipzig.de$1");
}

function cleanupHTML(html) {
  return html.replace(/<[^>]*>/g, '');
}

function dict(word, onNewEntry, onLoaded) {
  getPage("https://dict.com/ukrainisch-deutsch/%s", word)
    .then(html => {
      let doc = new DOMParser().parseFromString(html, 'text/html');
      let tables = doc.querySelectorAll('#mycol-center table');
      tables.forEach(t => {
          const entries = dictTable2Entries(t);
          console.log(t.innerHTML, entries);
          entries.forEach(onNewEntry);
      });
    })
    .finally(() => onLoaded());
}

function dictTable2Entries(doc) {
  const results = [];
  const source = "dict.com";

  // 1) Grab the main German word + morphological info from the "head" row.
  //    E.g. <span class="lex_ful_entr l1">Hund</span><span class="lex_ful_morf"> m</span>
  const headRow = doc.querySelector('tr.head');
  if (headRow) {
    const germanSpan = headRow.querySelector('.lex_ful_entr.l1');
    const morphSpan = headRow.querySelector('.lex_ful_morf');
    if (germanSpan) {
      let germanWord = germanSpan.textContent.trim(); // "Hund"
      let morph = morphSpan ? morphSpan.textContent.trim() : ""; // "m" or "phr"

      // Convert "m" => "{m}" for the German side:
      if (morph === 'm') {
        morph = '{m}';
      } else if (morph) {
        morph = `{${morph}}`;
      }

      // 2) The next row often has the Ukrainian translations in a span: <span class="lex_ful_tran w l2">...</span>
      const tranSpan = doc.querySelector('.lex_ful_tran.w.l2');
      if (tranSpan) {
        // Something like: "соба́ка <span class='lex_ful_g'>m</span>, пес <span class='lex_ful_g'>m</span>"
        // We'll split by commas in case multiple translations in one element
        const allParts = tranSpan.innerHTML.split(/\s*,\s*/);

        for (let part of allParts) {
          // Replace <span class="lex_ful_g">m</span> with "{ч}" for Ukrainian morphological info
          let ukHTML = part.replace(/<span class="lex_ful_g">m<\/span>/g, '{ч}');
          // Remove leftover HTML tags
          let ukText = ukHTML.replace(/<[^>]*>/g, '').trim(); 
          
          // Combine the morphological info with the German word
          let germanFull = morph ? `${germanWord} ${morph}`.trim() : germanWord;

          results.push({
            de: germanFull,
            uk: ukText,
            source
          });
        }
      }
    }
  }

  // 3) Phrases / collocations:
  //    E.g. <span class="lex_ful_coll2"><span class="lex_ful_coll2s w l1">den Hund ausführen</span>
  //                          <span class="lex_ful_coll2t w l2">ви́гуляти соба́ку</span></span>
  //         <span class="lex_ful_coll2"><span class="lex_ful_coll2s w l1">junger Hund</span>
  //                          <span class="lex_ful_coll2t w l2">пе́сик <span class="lex_ful_g">m</span>, соба́чка <span class="lex_ful_g">m</span></span></span>
  const coll2Els = doc.querySelectorAll('.lex_ful_coll2');
  coll2Els.forEach(coll2 => {
    const germanPhrase = coll2.querySelector('.lex_ful_coll2s.w.l1');
    const ukrPhrase = coll2.querySelector('.lex_ful_coll2t.w.l2');
    if (germanPhrase && ukrPhrase) {
      let gerText = germanPhrase.textContent.trim(); 
      // The Ukrainian side can have multiple items separated by commas
      let ukHTML = ukrPhrase.innerHTML.split(/\s*,\s*/);

      ukHTML.forEach(fragment => {
        // Replace morphological info <span class="lex_ful_g">m</span> => "{ч}"
        let replaced = fragment.replace(/<span class="lex_ful_g">m<\/span>/g, '{ч}');
        let ukText = replaced.replace(/<[^>]*>/g, '').trim();

        results.push({
          de: gerText,
          uk: ukText,
          source
        });
      });
    }
  });

  return results;
}

function multitran(word, onNewEntry, onLoaded) {
  getPage("https://www.multitran.com/m.exe?ll1=3&ll2=33&s=%s&l2=33", word)
    .then(html => {
      // console.log("multitran loaded this:", html);
      let doc = new DOMParser().parseFromString(html, 'text/html');
      let tables = doc.querySelectorAll('table');
      let result = [];
      tables.forEach(t => {
          if(t.innerHTML.includes("gif/logoe.gif")) {
              // skip logo
              return;
          }
         const entries = parseMultitranHTML(t);
        entries.forEach(onNewEntry);
      });
    })
    .finally(() => onLoaded());
}

function parseMultitranHTML(doc) {
  const source = "multitran";
  const results = [];

  // The pattern is:
  // 1) A "header row" with td.orig11 => has the German word + morphological data, e.g. "Hund [hʊnt] m -(e)s, -e"
  // 2) Followed by zero or more rows each with td.subj (subject area) and td.trans (translation).
  // 3) Another "header row" (td.orig11) indicates the start of a new block (new German headword).
  
  // We'll locate each "orig11" block, parse the German side, then parse subsequent subject/translation rows
  // until the next "orig11" or the table ends.

  // Gather all rows first
  const allRows = Array.from(doc.querySelectorAll('tr'));
  
  let currentGerman = ""; // store the current German heading
  let currentMorph = "";  // morphological info
  let currentPron = "";   // optional pron like [hʊnt]
  
  function parseGermanRow(orig11Row) {
    // Example: <td colspan="2" class="orig11"><table> <a>Hund</a> <span>[hʊnt]</span> <em><span>m -(e)s, -e</span></em>
    const germanCell = orig11Row.querySelector('td.orig11 table td[valign="top"]');
    if (!germanCell) return { germanWord: "", morph: "", pron: "" };

    let text = germanCell.textContent.trim(); 
    // text might look like: "Hund [hʊnt] m -(e)s, -e"

    // We can parse out the main German word, optional pron, morphological info, etc.
    // For simplicity, let's separate them step by step:
    const linkEl = germanCell.querySelector('a[href*="m.exe"]');
    const pronSpan = germanCell.querySelector('span[style*="color:gray"]');
    const morphSpan = germanCell.querySelector('em span[style*="color:gray"]');

    let germanWord = linkEl ? linkEl.textContent.trim() : "";
    let pron = pronSpan ? pronSpan.textContent.trim() : ""; 
    let morph = morphSpan ? morphSpan.textContent.trim() : ""; 
    // We might wrap morphological info as {m} etc.

    return {
      germanWord,
      pron,
      morph
    };
  }

  function buildGermanString(word, pron, morph) {
    // E.g. "Hund {m} [hʊnt]"
    // If morph has "m" or "f", etc., we can transform "m" => "{m}"
    // For simplicity, let's just do: if morph contains "m", wrap it in {m}
    // If there's a bracket pron, we can place it after the word.

    let morphClean = morph;
    if (morphClean.startsWith("m")) {
      morphClean = "{m} " + morphClean.substring(1).trim();
    } else if (morphClean) {
      // put curly braces around the entire morphological block
      morphClean = `{${morphClean}}`;
    }

    let parts = [];
    if (word) parts.push(word);
    if (morphClean) parts.push(morphClean);
    if (pron) parts.push(`[${pron.replace(/\[|\]/g, '')}]`);  // ensure single brackets

    return parts.join(" ");
  }

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    // Check if this row is a header row with the .orig11
    if (row.querySelector('td.orig11')) {
      // parse new German heading
      const { germanWord, pron, morph } = parseGermanRow(row);
      currentGerman = germanWord; 
      currentPron = pron;
      currentMorph = morph;
      continue;
    }

    // else check if this row has the translation columns
    const subjTd = row.querySelector('td.subj');
    const transTd = row.querySelector('td.trans');

    if (subjTd && transTd) {
      // This is a translation row. The left side is subject area, right side is the translation(s).
      // e.g. <td class="trans"><a>пес</a> <i><span>m</span></i></td>
      let ukParts = transTd.innerHTML;  
      // We might replace morphological <span> with {m} or {ч} or something else.

      // Extract visible text from transTd
      // e.g. "пес m" or "собака m (Canis lupus (familiaris))"
      let ukText = transTd.textContent.trim();

      // For morphological info, if we see something like "m" in gray, you can decide to wrap it in curly braces.
      // One approach is to use a regex to replace " m" => " {m}" or something similar.
      // Or we can parse the HTML more carefully. For now, let's do a quick replacement:
      ukText = ukText.replace(/\bm\b/g, '{m}');

      // Build the final German string
      let germanString = buildGermanString(currentGerman, currentPron, currentMorph);

      results.push({
        de: germanString.trim(),
        uk: ukText,
        source
      });
    }
  }

  return results;
}

function wiki(word, onNewEntry, onLoaded) {
  getPage("https://de.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|langlinks&lllang=uk&exintro&explaintext&redirects=1&titles=%s", word)
  .then(jsonStr => {
    const data = JSON.parse(jsonStr);
    let pages = data.query && data.query.pages;
    for (let pageId in pages) {
        let page = pages[pageId];
        let title = page.title;
        if(page.missing !== undefined) {
            onNewEntry({
              de: `not found. <a target="_blank" href="https://de.wikipedia.org/w/index.php?fulltext=1&search=${encodeURIComponent(title)}&title=Spezial%3ASuche&ns0=1">
				Search Wiki</a>`,
              uk: `<a target="_blank" href="https://uk.wikipedia.org/w/index.php?fulltext=1&search=${encodeURIComponent(word)}&title=%D0%A1%D0%BF%D0%B5%D1%86%D1%96%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0:%D0%9F%D0%BE%D1%88%D1%83%D0%BA&ns0=1">пошук</a>`,
              source: "wiki"
            })
        }
        let extract = page.extract;
        let links = page.langlinks || [];
        let entry = {
          de: `${title}: ${extract}`,
          source: "wiki"
        };
        if (links.length === 0) {
          onNewEntry(entry);
          break
        }
        let link = links[0]["*"];
        entry.uk = `<a href='https://uk.wikipedia.org/wiki/${encodeURIComponent(link)}'>${link}</a>`;
        onNewEntry(entry);
        
    }
    // let parsed = parseWiki(jsonStr);
    // onNewEntry({source: "wiki", "de": parsed});
  })
  .finally(() => onLoaded());
}

function parseWiki(jsonStr) {
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        return "Failed to parse JSON: " + e.message;
    }

    let pages = data.query && data.query.pages;
    if(!pages) return "No result.";
    for (let pageId in pages) {
        let page = pages[pageId];
        let title = page.title;
        if(page.missing !== undefined) {
            return `Page not found.
				<a href="https://de.wikipedia.org/w/index.php?fulltext=1&search=${encodeURIComponent(title)}&title=Spezial%3ASuche&ns0=1">
				Search Wikipedia</a>`;
        }
        let extract = page.extract;
        let links = page.langlinks || [];
        if (links.length === 0) {
            return `<h1>${title}</h1>\n<p>${extract}</p>`;
        }
        let link = links[0]["*"];
        return `<h1>${title}</h1>\n<p>${extract}</p>\n<p><a href='https://uk.wikipedia.org/wiki/${encodeURIComponent(link)}'>:uk:${link}</a></p>`;
    }
    return "No result.";
}

async function getPage(dictURL, word) {
    let encodedWord = encodeURIComponent(word);
    let url = dictURL.replace("%s", encodedWord);
    // Check cache
    let resp = await fetch(url, {cache: 'force-cache'});
    if (!resp.ok) {
        throw new Error("Request failed: " + resp.status);
    }
    let text = await resp.text();
    // Cache response
    return text;
}
