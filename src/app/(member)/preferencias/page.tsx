import { SettingsSection } from '@/components/workspace-layout';
import Link from 'next/link';
import { PageHeading } from '@/components/page-heading';
import { member } from '@/server/auth';
import { check } from '@/lib/errors';
import { preferences, followCity } from '@/server/community-actions';
import { ActionForm } from '@/components/action-form';
import { CitySelector } from '@/components/city-selector';
import { addTopicAlert, removeTopicAlert } from '@/server/discovery-actions';
export const metadata = { title: 'Preferências' };
export default async function Preferences() {
  const { db, profile } = await member();
  const [prefs, follows, alertsResult] = await Promise.all([
    db.from('user_preferences').select('*').maybeSingle(),
    db.from('followed_cities').select('*').order('created_at'),
    db.from('topic_alerts').select('*').order('created_at').order('id'),
  ]);
  const pref = check(prefs),
    followed = check(follows),
    alerts = check(alertsResult);
  const cityIds = [
    ...new Set([
      ...followed.map((r) => r.city_id),
      ...alerts.map((r) => r.city_id),
      profile.home_city_id,
    ]),
  ];
  const allCities = cityIds.length
    ? check(await db.from('cities').select('*').in('id', cityIds))
    : [];
  const cities = allCities.filter((c) => followed.some((r) => r.city_id === c.id));
  const cityMap = new Map(allCities.map((c) => [c.id, c]));
  return (
    <div className="settings-page">
      <PageHeading
        title="Preferências"
        description="Escolha as conversas e cidades que quer acompanhar."
      />
      <SettingsSection title="Lembretes">
        <ActionForm action={preferences} label="Salvar preferências">
          <label className="checkbox">
            <input
              type="checkbox"
              name="emailReminders"
              defaultChecked={pref?.email_reminders ?? false}
            />
            Receber por e-mail lembretes de pedidos aguardando minha decisão
          </label>
          <p className="hint">
            Um lembrete por pedido a cada semana. Você pode desativar a qualquer momento.
          </p>
        </ActionForm>
      </SettingsSection>
      <SettingsSection title="Alertas por assunto">
        <p className="muted">
          Receba avisos na central de notificações quando novos pedidos da cidade mencionarem um
          assunto que você conhece. Até 12 alertas.
        </p>
        <div className="community-list topic-alert-list">
          {alerts.map((alert) => {
            const city = cityMap.get(alert.city_id);
            return (
              <article key={alert.id} className="community-row">
                <div>
                  <strong>{alert.term}</strong>
                  <p className="hint">
                    {city?.name} — {city?.state_code}
                  </p>
                </div>
                <ActionForm
                  action={removeTopicAlert}
                  label="Remover alerta"
                  className="compact quiet"
                >
                  <input type="hidden" name="id" value={alert.id} />
                </ActionForm>
              </article>
            );
          })}
        </div>
        <ActionForm action={addTopicAlert} label="Criar alerta" disabled={alerts.length >= 12}>
          <label className="field">
            Assunto do alerta
            <input
              name="term"
              minLength={3}
              maxLength={80}
              placeholder="Peças de bicicleta, café, costura…"
              required
            />
          </label>
          <CitySelector initial={cityMap.get(profile.home_city_id)} />
          <p className="hint">
            Usamos as palavras do assunto para encontrar pedidos relacionados. Você pode remover o
            alerta a qualquer momento.
          </p>
        </ActionForm>
      </SettingsSection>
      <SettingsSection title="Cidades que acompanho">
        <p className="muted">Salve até 8 cidades para acessar os pedidos com mais facilidade.</p>
        <div className="community-list">
          {cities.map((c) => (
            <article key={c.id} className="community-row">
              <Link href={'/app?city=' + c.id}>
                {c.name} — {c.state_code} ↗
              </Link>
              <ActionForm action={followCity} label="Remover cidade" className="compact quiet">
                <input type="hidden" name="cityId" value={c.id} />
                <input type="hidden" name="follow" value="false" />
              </ActionForm>
            </article>
          ))}
        </div>
        <ActionForm action={followCity} label="Acompanhar cidade" disabled={followed.length >= 8}>
          <CitySelector />
          <input type="hidden" name="follow" value="true" />
        </ActionForm>
      </SettingsSection>
    </div>
  );
}
