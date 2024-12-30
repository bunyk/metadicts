import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

function Search({q}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(q);

  return (
	<input type="text"
		placeholder="Введіть слово для пошуку..."
	  	value={query}
	    onChange={(e) => setQuery(e.target.value)}
	  	onKeyDown={(e) => {
			if (e.key === 'Enter') {
				navigate(`/search/${e.target.value}`);
			}
		}}
	    style={{
            padding: "6px",
			margin: "4px",
            border: "1px solid #d3d3d3",
            borderRadius: "12px",
			width: "500px",
			fontSize: "14px"
		}}	

	/>
  )
}

export default Search
