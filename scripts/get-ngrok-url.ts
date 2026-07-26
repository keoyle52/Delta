async function getNgrokUrl() {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (res.ok) {
      const data: any = await res.json();
      const publicUrl = data.tunnels?.[0]?.public_url;
      if (publicUrl) {
        console.log('NGROK_PUBLIC_URL=' + publicUrl);
        return;
      }
    }
  } catch (err: any) {
    console.error('Ngrok API query error:', err.message);
  }
}

getNgrokUrl();
