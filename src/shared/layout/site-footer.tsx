import { Link } from '@tanstack/react-router'
import { BellRing, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { cn } from '@/shared/lib/utils'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/shared/ui/icons'
import { RealtimeIndicator } from './realtime-indicator'

/** The W/C/D letters of the layout are replaced by informative icons (DECISOES.md). */
const SERVICES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: ShieldCheck,
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    icon: Sparkles,
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    icon: BellRing,
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/', icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com/', icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: YoutubeIcon },
]

const columnTitle = 'text-lg leading-4 font-bold text-foreground'
const columnItem = 'text-sm leading-[30px] text-foreground'
const linkItem = cn(columnItem, 'hover:text-brand-accent hover:underline underline-offset-4')
/** Out-of-scope destinations: listed (as in the layout) but not links, so nothing pretends to work. */
const soonItem = cn(columnItem, 'text-text-secondary')

/** Same "em breve" mark as the header: visible text, kept on the item's line. */
function SoonMark() {
  return (
    <span className="ml-1.5 rounded-xs border border-line-soft px-1 align-[1px] text-[10px] leading-3 whitespace-nowrap text-text-muted">
      <span className="sr-only">(</span>em breve<span className="sr-only">)</span>
    </span>
  )
}

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage({ tone: 'error', text: 'Informe um e-mail válido.' })
      return
    }
    // Out of scope: say so instead of faking a subscription.
    setMessage({
      tone: 'info',
      text: 'A newsletter ainda não está disponível nesta demonstração. Nenhum dado foi enviado.',
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <h2 className="text-lg leading-4 font-bold text-foreground">Antecipe-se ao próximo lançamento</h2>
      <div className="mt-4 flex h-10 rounded-sm bg-surface-dark shadow-[0_0_20px_0_#0a060473]">
        <label htmlFor={`${id}-email`} className="sr-only">
          Seu e-mail
        </label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={message?.tone === 'error' || undefined}
          aria-describedby={message ? `${id}-message` : undefined}
          className="min-w-0 flex-1 rounded-l-sm bg-transparent px-3 text-sm text-foreground placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-brand-accent"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-r-sm bg-brand pr-1 pl-4 text-lg leading-4 font-bold text-ink hover:bg-brand-accent"
        >
          Enviar
        </button>
      </div>
      <p
        id={`${id}-message`}
        role={message?.tone === 'error' ? 'alert' : 'status'}
        className={cn(
          'mt-3 text-[13px] leading-[22px]',
          message?.tone === 'error' ? 'text-coral' : 'text-text-secondary',
        )}
      >
        {message?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </form>
  )
}

/** Footer of every screen (Figma "Footer" component). */
export function SiteFooter() {
  return (
    <footer className="container-page mt-16 md:mt-24">
      <section
        aria-label="Serviços KURIO"
        className="grid grid-cols-1 gap-8 bg-surface p-6 md:grid-cols-2 md:p-8 xl:grid-cols-[265px_265px_265px_1fr] xl:gap-0 xl:pb-4"
      >
        {SERVICES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex flex-col gap-3 lg:border-r lg:border-brand lg:px-4">
            <span className="grid size-[74px] place-content-center rounded-full bg-brand text-ink" aria-hidden="true">
              <Icon className="size-8" strokeWidth={2} />
            </span>
            <h2 className="text-[17px] leading-4 font-bold text-foreground">{title}</h2>
            <p className="max-w-[204px] text-sm leading-[22px] text-text-secondary">{text}</p>
          </div>
        ))}
        <div className="xl:pl-4">
          <Newsletter />
        </div>
      </section>

      <div className="grid gap-4 bg-surface-dark px-6 py-6 text-sm leading-[22px] text-foreground sm:grid-cols-2 md:px-8 xl:grid-cols-[211px_211px_211px_1fr] xl:items-center xl:gap-x-[91px] xl:py-[22px]">
        <Link to="/" className="text-sm font-bold tracking-[0.1em]">
          KURIO
        </Link>
        <p className="lg:whitespace-nowrap">
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        {/* Sample contacts of the layout: plain text, not mailto:/tel: links that would open real apps. */}
        <p>
          contato@email.com<span className="sr-only"> (contato de exemplo)</span>
        </p>
        <p>
          +55 11 4002 8922<span className="sr-only"> (telefone de exemplo)</span>
        </p>
      </div>

      <div className="grid gap-10 bg-surface px-6 py-8 sm:grid-cols-2 md:px-8 xl:grid-cols-[211px_211px_211px_1fr] xl:gap-x-[91px] xl:pb-[29px]">
        <nav aria-labelledby="footer-profile" className="flex flex-col gap-2">
          <h2 id="footer-profile" className={columnTitle}>
            Meu perfil
          </h2>
          <ul>
            <li>
              <Link to="/account/profile" className={linkItem}>
                Meu perfil
              </Link>
            </li>
            {/* There is no collection page (owned NFTs) in scope: "Atividade" is the order history. */}
            <li className={soonItem}>
              Minha coleção
              <SoonMark />
            </li>
            <li>
              <Link to="/orders" className={linkItem}>
                Atividade
              </Link>
            </li>
            <li className={cn(soonItem, 'whitespace-nowrap')}>
              Estúdio do criador
              <SoonMark />
            </li>
            <li>
              <Link to="/account/favorites" className={linkItem}>
                Lista de interesse
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex flex-col gap-2">
          {/* One line, as in the frame: the mark may run into the 91px gap between columns. */}
          <h2 className={cn(columnTitle, 'whitespace-nowrap')}>
            Central de ajuda
            <SoonMark />
          </h2>
          <ul>
            {[
              'Central de ajuda',
              'Como comprar NFTs',
              'Carteira e segurança',
              'Política do mercado',
              'Denunciar item',
            ].map((item) => (
              <li key={item} className={soonItem}>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-labelledby="footer-collections" className="flex flex-col gap-2">
          <h2 id="footer-collections" className={columnTitle}>
            Coleções
          </h2>
          <ul>
            {(
              [
                ['Arte digital', 'art'],
                ['Fotografia', 'photography'],
                ['Música', 'music'],
                ['Jogos', 'gaming'],
                ['Colecionáveis', 'collectibles'],
              ] as const
            ).map(([label, category]) => (
              <li key={category}>
                <Link
                  to="/"
                  search={{ category: [category] }}
                  hash="catalogo"
                  activeOptions={{ includeHash: true }}
                  className={linkItem}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h2 className={columnTitle}>Redes sociais</h2>
            <ul className="flex gap-2.5">
              {SOCIAL.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (abre em nova aba)`}
                    className="grid size-[30px] place-content-center rounded-xs border border-brand text-brand hover:bg-brand hover:text-ink"
                  >
                    <Icon className="size-[30px]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className={columnTitle}>Carteiras compatíveis</h2>
            <p className="w-fit rounded-sm border border-line-soft bg-surface-dark py-1.5 pr-1 pl-2 text-[9px] leading-3 font-bold tracking-[0.1px] text-brand-accent">
              METAMASK&nbsp;&nbsp;•&nbsp;&nbsp;WALLETCONNECT&nbsp;&nbsp;•&nbsp;&nbsp;COINBASE
            </p>
          </div>
        </div>
      </div>

      {/* Copyright centered as in the frame; the live-connection status sits at the right edge (own line on small screens). */}
      <div className="relative flex flex-col items-center gap-1 pt-1.5 pb-6 text-center text-sm leading-[30px] text-foreground lg:block">
        <p>© 2026 Kurio. Propriedade digital para todos.</p>
        <div className="lg:absolute lg:top-1.5 lg:right-0 lg:flex lg:h-[30px] lg:items-center">
          <RealtimeIndicator />
        </div>
      </div>
    </footer>
  )
}
