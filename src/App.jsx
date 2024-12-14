import './App.css'
import { BrowserRouter, Routes, Route } from "react-router";
import SearchPage from "./SearchPage";
import ConfigPage from "./ConfigPage";

function App() {
  return (
	  <BrowserRouter>
	  	<Routes>
	  		<Route path="/" element={<SearchPage />} />
	  		<Route path="/search/:q?" element={<SearchPage />} />
	  		<Route path="/config" element={<ConfigPage />} />
	  	</Routes>
	  </BrowserRouter>
  )
}

export default App
