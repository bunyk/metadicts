import { useState, useEffect } from 'react';

const borderStyle = {
	border: "1px solid #d3d3d3",
	margin: "0px",
	padding: "0.5em",
}

async function fetchTranslations(word) {
	await new Promise(r => setTimeout(r, 2000));
	return [
		{de: "Paradebeispiel", uk: "приклад {ч}", source:"udew"},
		{de: "Paradebeispiel", uk: "зразок {ч}", source:"dict.com"},
	]
}

export default function Translations({ word }) {
	const [translations, setTranslations] = useState([])
	const [loading, setLoading] = useState(true)

	  useEffect(() => {
		 async function getTranslations() {
			 const translations = await fetchTranslations(word);
			 setTranslations(translations);
			 setLoading(false);
		 }
		 getTranslations();
	  }, [word, setTranslations])
	return (
		<div style={{
			marginLeft: "320px",
				padding: "3em",
		}}>
			<table style={{
				... borderStyle,
				borderCollapse: 'collapse'
			}}>
				<tr>
					<th>Deutsch</th>
					<th>Ukrainisch</th>
					<th>Quelle</th>
				</tr>
				{translations.map((t, i) => (
					<tr key={i}>
						<td style={borderStyle}>{t.de}</td>
						<td style={borderStyle}>{t.uk}</td>
						<td style={borderStyle}>{t.source}</td>
					</tr>
				))}	
			</table>
			{loading && <p>Loading...</p>}
		</div>
	)
}
