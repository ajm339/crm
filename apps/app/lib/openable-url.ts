const HTTP_SCHEME = /^https?:\/\//i;

const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function openableUrl(
	value: string | null | undefined,
	{ assumeHttps = false }: { assumeHttps?: boolean } = {},
): string | null {
	const trimmed = value?.trim();
	if (!trimmed || /\s/.test(trimmed)) return null;

	const candidate = HTTP_SCHEME.test(trimmed)
		? trimmed
		: assumeHttps
			? `https://${trimmed}`
			: null;
	if (!candidate || !URL.canParse(candidate)) return null;

	return HOSTNAME.test(new URL(candidate).hostname) ? candidate : null;
}
