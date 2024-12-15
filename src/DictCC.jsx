
export default function DictCC({ word }) {
	return <iframe
		src={`https://deuk.dict.cc/?s=${word}`}
		style={{
			width: '100%',
			height: '100%',
			border: 'none'
		}}></iframe>
}
