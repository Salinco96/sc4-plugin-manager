import { Banner, type BannerProps } from "./Banner"

export interface BannersProps {
  banners: Array<Omit<BannerProps, "children" | "compact"> & { message: BannerProps["children"] }>
  compact?: boolean
}

export function Banners({ banners, compact }: BannersProps): JSX.Element {
  return (
    <>
      {banners.map(
        (banner, index) =>
          banner && (
            // biome-ignore lint/suspicious/noArrayIndexKey: no better key
            <Banner key={index} {...banner} compact={compact}>
              {banner.message}
            </Banner>
          ),
      )}
    </>
  )
}
