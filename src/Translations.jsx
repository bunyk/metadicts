import { useState, useEffect } from 'react';
import { loadTranslations } from './dictionaries.js';

const borderStyle = {
	border: "1px solid #d3d3d3",
	margin: "0px",
	padding: "0.3em",
}

export default function Translations({ word }) {
	const [translations, setTranslations] = useState([])
	const [loading, setLoading] = useState(null);

	  useEffect(() => {
		  setLoading(true);
		  setTranslations([]);
		  loadTranslations(word, (entry) => {
			  setTranslations((prev) => [...prev, entry]);
		  }, () => {
			  setLoading(false);
		  })
	  }, [word, setTranslations])
	console.log(translations)
	return (
		<div style={{
			padding: "1em",
		}}>
			<table style={{
				... borderStyle,
				borderCollapse: 'collapse'
			}}>
				<tr>
					<th>Deutsch</th>
					<th>Українська</th>
					<th>Джерело</th>
				</tr>
				{translations.map((t, i) => (
					<tr key={i}>
						<td style={borderStyle}
							dangerouslySetInnerHTML={{__html: t.de}}
						></td>
						<td style={borderStyle}
							dangerouslySetInnerHTML={{__html: t.uk}}
						></td>
						<td style={borderStyle}>{t.source}</td>
					</tr>
				))}	
			</table>
			{loading && <p>Loading...</p>}
		</div>
	)
}
