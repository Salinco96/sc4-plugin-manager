interface Modals {
  "missing-packages": {
    packageIds: string[]
  }
}

export type ModalID = keyof Modals
export type ModalData<T extends ModalID> = Modals[T]
