import Image from 'next/image'
import BrandLogo from 'public/sci-logo.png'

export function Logo() {
  return <Image src={BrandLogo} alt="Brand Logo" width={500} height={500} />
}
