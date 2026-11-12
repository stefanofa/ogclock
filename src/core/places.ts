import { momentAt } from "./moment.ts";
import { type Zone, zoneById } from "./zone.ts";

/** A place people know by name, with the words that put you there: "in Fiji". */
export interface Place {
	readonly phrase: string;
	readonly zone: Zone;
}

/**
 * Recognisable places, at least one for every UTC offset in use in both seasons (the tests
 * sweep every minute of a January and a July day). Order matters: a place's position among
 * those sharing its hour decides which minutes pick it.
 */
const PLACES_BY_ZONE: readonly (readonly [phrase: string, zone: string])[] = [
	["in American Samoa", "Pacific/Pago_Pago"],
	["on Niue", "Pacific/Niue"],
	["in Hawaii", "Pacific/Honolulu"],
	["in Tahiti", "Pacific/Tahiti"],
	["in the Cook Islands", "Pacific/Rarotonga"],
	["in the Marquesas", "Pacific/Marquesas"],
	["in the Aleutians", "America/Adak"],
	["in the Gambier Islands", "Pacific/Gambier"],
	["in Alaska", "America/Anchorage"],
	["on Pitcairn", "Pacific/Pitcairn"],
	["in Los Angeles", "America/Los_Angeles"],
	["in Vancouver", "America/Vancouver"],
	["in Phoenix", "America/Phoenix"],
	["in Denver", "America/Denver"],
	["in Mexico City", "America/Mexico_City"],
	["in Chicago", "America/Chicago"],
	["in Costa Rica", "America/Costa_Rica"],
	["on Easter Island", "Pacific/Easter"],
	["in New York", "America/New_York"],
	["in Lima", "America/Lima"],
	["in Bogotá", "America/Bogota"],
	["in Cancún", "America/Cancun"],
	["in Puerto Rico", "America/Puerto_Rico"],
	["in Barbados", "America/Barbados"],
	["in Halifax", "America/Halifax"],
	["in Newfoundland", "America/St_Johns"],
	["in Buenos Aires", "America/Argentina/Buenos_Aires"],
	["in Rio", "America/Sao_Paulo"],
	["on Fernando de Noronha", "America/Noronha"],
	["in Nuuk", "America/Nuuk"],
	["in Cape Verde", "Atlantic/Cape_Verde"],
	["in the Azores", "Atlantic/Azores"],
	["in Reykjavík", "Atlantic/Reykjavik"],
	["in London", "Europe/London"],
	["in Lisbon", "Europe/Lisbon"],
	["in Dakar", "Africa/Dakar"],
	["in Paris", "Europe/Paris"],
	["in Rome", "Europe/Rome"],
	["in Lagos", "Africa/Lagos"],
	["in Athens", "Europe/Athens"],
	["in Cape Town", "Africa/Johannesburg"],
	["in Cairo", "Africa/Cairo"],
	["in Istanbul", "Europe/Istanbul"],
	["in Nairobi", "Africa/Nairobi"],
	["in Zanzibar", "Africa/Dar_es_Salaam"],
	["in Moscow", "Europe/Moscow"],
	["in Tehran", "Asia/Tehran"],
	["in Dubai", "Asia/Dubai"],
	["in the Seychelles", "Indian/Mahe"],
	["in Mauritius", "Indian/Mauritius"],
	["in the Maldives", "Indian/Maldives"],
	["in Tashkent", "Asia/Tashkent"],
	["in Karachi", "Asia/Karachi"],
	["in Kabul", "Asia/Kabul"],
	["in Mumbai", "Asia/Kolkata"],
	["in Sri Lanka", "Asia/Colombo"],
	["in Kathmandu", "Asia/Kathmandu"],
	["in Dhaka", "Asia/Dhaka"],
	["in Bhutan", "Asia/Thimphu"],
	["in Yangon", "Asia/Yangon"],
	["on the Cocos Islands", "Indian/Cocos"],
	["in Bangkok", "Asia/Bangkok"],
	["in Hanoi", "Asia/Ho_Chi_Minh"],
	["on Christmas Island", "Indian/Christmas"],
	["in Singapore", "Asia/Singapore"],
	["in Bali", "Asia/Makassar"],
	["in Hong Kong", "Asia/Hong_Kong"],
	["in Perth", "Australia/Perth"],
	["in Eucla", "Australia/Eucla"],
	["in Tokyo", "Asia/Tokyo"],
	["in Seoul", "Asia/Seoul"],
	["in Palau", "Pacific/Palau"],
	["in Darwin", "Australia/Darwin"],
	["in Adelaide", "Australia/Adelaide"],
	["in Brisbane", "Australia/Brisbane"],
	["in Guam", "Pacific/Guam"],
	["on Lord Howe Island", "Australia/Lord_Howe"],
	["in Sydney", "Australia/Sydney"],
	["in the Solomon Islands", "Pacific/Guadalcanal"],
	["in New Caledonia", "Pacific/Noumea"],
	["in Tuvalu", "Pacific/Funafuti"],
	["in the Marshall Islands", "Pacific/Majuro"],
	["in Fiji", "Pacific/Fiji"],
	["in Auckland", "Pacific/Auckland"],
	["on the Chatham Islands", "Pacific/Chatham"],
	["in Tonga", "Pacific/Tongatapu"],
	["in Samoa", "Pacific/Apia"],
	["on Kiritimati", "Pacific/Kiritimati"],
];

export const PLACES: readonly Place[] = PLACES_BY_ZONE.map(([phrase, id]) => {
	const zone = zoneById(id);
	if (!zone) throw new Error(`places: unknown zone ${id}`);
	return { phrase, zone };
});

/** The places whose local hour is `hour` at `instant`, in list order. DST-correct. */
export const placesAtHour = (instant: number, hour: number): readonly Place[] =>
	PLACES.filter((place) => momentAt(instant, place.zone).hour === hour);
