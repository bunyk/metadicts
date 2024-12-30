import './App.css'
import { HashRouter, Routes, Route } from "react-router";
import SearchPage from "./SearchPage";
import ConfigPage from "./ConfigPage";

function App() {
  return (
	  <HashRouter>
	  	<Routes>
	  		<Route path="/" element={<SearchPage />} />
	  		<Route path="/search/:q?" element={<SearchPage />} />
	  		<Route path="/config" element={<ConfigPage />} />
	  	</Routes>
	  </HashRouter>
  )
}

export default App
