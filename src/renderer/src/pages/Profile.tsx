import { useCurrentProfile } from "@renderer/utils/store"

function Profile(): JSX.Element {
  const currentProfile = useCurrentProfile()

  return <pre style={{ width: "100%" }}>{JSON.stringify(currentProfile, undefined, 2)}</pre>
}

export default Profile
