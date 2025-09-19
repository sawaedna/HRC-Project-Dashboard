import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'

// Load Three.js only on client
const ThreeScene = dynamic(() => import('../src/three/ThreeScene'), { ssr: false })

export default function Page3D() {
  const [dataUrl] = useState('/api/sheets')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(dataUrl);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      setData(json.data.detailed);
    } catch (e) {
      setError(e.message);
      console.error('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData() }, []); // load local data on mount

  return (
    <>
      <Head>
        <title>3D Data City - Prototype</title>
      </Head>
      <div className="three-page" style={{ width: 1800, height: 850 }}>
        <div className="left-panel">
          <h2>Data City</h2>
          <p>يستخدم المشروع بيانات الملف المحلي الآن.</p>
          <button onClick={() => fetchData()} style={{ margin: '10px 0', padding: '5px 15px' }}>{loading ? 'جاري التحديث...' : 'تحديث البيانات'}</button>
          <div className="legend">
            <div><span className="swatch planned"/> Planned</div>
            <div><span className="swatch actual"/> Actual</div>
          </div>
        </div>

        <div className="canvas-area">
          <ThreeScene data={data} width={1800 - 420} height={850} />
        </div>
      </div>
    </>
  )
}
