import { Masthead } from '@corchetes/ui'
import { InteractiveTreeDemo } from './InteractiveTreeDemo'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <main className={styles.main}>
      <Masthead editionNumber={142} />

      <div className={styles.contentWrapper}>
        <InteractiveTreeDemo />
      </div>
    </main>
  )
}
