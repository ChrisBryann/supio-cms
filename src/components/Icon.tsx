import Image from 'next/image'
import BrandIcon from 'public/favicon.ico'

export function Icon() {
  return <Image src={BrandIcon} alt="Brand Icon" fill />
}
