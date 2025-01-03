import { useParams } from 'react-router'

import Search from './Search.jsx'
import Backlog from './Backlog.jsx'
import Translations from './Translations.jsx'
import DictCC from './DictCC.jsx'


export default function SearchPage() {
	let params = useParams()
  return (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        margin: 0,
        padding: 0
	}}>
      <div style={{
          height: '40px',
          width: '100%',
          flexShrink: 0,          // Prevent the header from shrinking
          backgroundColor: '#eee'
	  }}>
        <Search key={params.q} q={params.q || ""} />
      </div>
      <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexGrow: 1,
          overflow: 'hidden' // Ensure no scrolling on the main container
	  }}>
        <div style={{
			width: '300px',
			overflowY: 'scroll',
		}}>
          <Backlog />
        </div>
        <div style={{
			flex: 1,
			overflowY: 'scroll',
		}}>
	  	    {params.q && <Translations word={params.q} />}
        </div>
        <div style={{
			flex: 1,
			overflowY: 'auto',
		}}>
	  		{params.q && <DictCC word={params.q} />}
        </div>
      </div>
    </div>
  );
}
