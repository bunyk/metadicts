import { Link } from "react-router";

export default function Backlog() {
	const backlog = (localStorage.getItem('backlog') || '').split('\n');

	return (<>
		<ul>
			{backlog.map((line, i) => (
				<li key={i}>
					<Link to={"/search/" + line}>{line}</Link>
				</li>
			))}
		</ul>
		<Link to="/config">Edit</Link>
	</>)
}
