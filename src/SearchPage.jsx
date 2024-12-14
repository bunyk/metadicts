import { useParams } from 'react-router'

import Search from './Search.jsx'
import Backlog from './Backlog.jsx'
import Translations from './Translations.jsx'

export default function SearchPage() {
	let params = useParams()
	return (
		<>
			<Search key={params.q} q={params.q || ''} />
			<Backlog />
			<Translations word={params.q} />
		</>
	)
}
