self.onmessage = async (e) => {
  const { url } = e.data;

  const res = await fetch(url);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  self.postMessage({ blob, bitmap }, [blob, bitmap]);
};
