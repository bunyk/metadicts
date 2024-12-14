import { Link } from "react-router";

import { useState, useEffect } from 'react';

export default function ConfigPage() {
	const [backlog, setBacklog] = useState(localStorage.getItem('backlog') || '');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
		localStorage.setItem('backlog', backlog
			.split('\n')
			.map((line) => line
				.replace(/\{\w\}/g, '')
				.replace(/\[[^\]]+\]/g, '')
				.trim()
			)
			.filter((line) => line.length > 0)
			.join('\n')
		);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [backlog]);
	return (
		<div>
			<Link to="/search/">Back to search</Link>
			<h2>Backlog:</h2>
			<textarea
				rows="50"
				cols="150"
				style={{
					margin: '12px',
				}}
				value={backlog}
				onChange={(e) => setBacklog(e.target.value)}
			/>
		</div>
	)
}
