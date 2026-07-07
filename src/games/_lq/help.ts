import { t, type I18nKey } from '../../i18n';

export function lqHelp(game: string): string {
  return t(`lq.help.${game}` as I18nKey);
}
