import Image from 'next/image'

// Phase A, stage 5: next/image with the default (server-optimizing) loader on
// a raster source. `.svg` is exempt — it has to be a png/jpg to hit the wall.
export default function ImgPage() {
  return (
    <main>
      <Image src="/pixel.png" alt="" width={100} height={100} />
    </main>
  )
}
