/**
 * One official's card. Renders office, name, party, district, contact methods.
 *
 * Missing contact fields render "Not listed" — never a placeholder value.
 * Per AGENTS.md: never invent a phone, email, address, or name.
 *
 * The left border uses the level color (federal/state/city) so the tier is
 * visible at a glance. Color is never the only signal — every card also
 * shows the level label.
 *
 * Cards for a district-based office (office.layerId is set) are tappable —
 * tapping highlights that district's boundary on the map (SPEC.md user
 * flow #6). Statewide/citywide cards have no single polygon to highlight,
 * so they render without the press affordance.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, geometry, levelColor } from "../styles/tokens";
import type { Office, Official } from "../lib/reps/types";
import type { DistrictLevel } from "../lib/districts/types";

interface OfficialCardProps {
  official: Official;
  focused?: boolean | undefined;
  onFocus?: ((office: Office) => void) | undefined;
}

const LEVEL_LABELS: Record<DistrictLevel, string> = {
  federal: "Federal",
  state: "State",
  city: "City",
};

function notListed(): string {
  return "Not listed";
}

function formatVerifiedOn(iso: string): string {
  // ISO date -> "Verified on Aug 11, 2026" style. Keep it simple, no locale deps.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `Verified on ${iso}`;
  return `Verified on ${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
}

export function OfficialCard({
  official,
  focused,
  onFocus,
}: OfficialCardProps) {
  const { office, name, party } = official;
  const stripeColor = levelColor(office.level);
  const layerId = office.layerId;

  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.levelLabel}>{LEVEL_LABELS[office.level]}</Text>
        <Text style={styles.officeTitle}>{office.title}</Text>
      </View>

      <Text style={styles.name}>{name}</Text>
      {party ? <Text style={styles.party}>{party}</Text> : null}

      <View style={styles.contactSection}>
        <ContactRow label="District office" value={official.districtOffice} />
        <ContactRow label="Capitol office" value={official.capitolOffice} />
        <ContactRow label="City Hall office" value={official.cityHallOffice} />
        <ContactRow
          label="Email"
          value={official.email ? { address: official.email } : undefined}
        />
        <ContactRow
          label="Contact form"
          value={
            official.contactFormUrl
              ? { address: official.contactFormUrl }
              : undefined
          }
        />
        <ContactRow
          label="Website"
          value={official.website ? { address: official.website } : undefined}
        />
      </View>

      <Text style={styles.verified}>
        {formatVerifiedOn(official.verifiedOn)}
      </Text>
    </>
  );

  const cardStyle = [
    styles.card,
    { borderLeftColor: stripeColor },
    focused ? styles.cardFocused : null,
  ];

  if (layerId && onFocus) {
    return (
      <Pressable
        style={cardStyle}
        onPress={() => onFocus(office)}
        accessibilityRole="button"
        accessibilityLabel={`Highlight ${office.title} on the map`}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

interface ContactRowProps {
  label: string;
  value?: { address?: string; phone?: string } | undefined;
}

function ContactRow({ label, value }: ContactRowProps) {
  const hasAddress = value?.address && value.address.length > 0;
  const hasPhone = value?.phone && value.phone.length > 0;
  const hasAnything = hasAddress || hasPhone;

  return (
    <View style={styles.contactRow}>
      <Text style={styles.contactLabel}>{label}</Text>
      {hasAnything ? (
        <View style={styles.contactValues}>
          {hasAddress ? (
            <Text style={styles.contactValue}>{value?.address}</Text>
          ) : null}
          {hasPhone ? (
            <Text style={styles.contactValue}>{value?.phone}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.notListed}>{notListed()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: geometry.r,
    padding: 16,
    gap: 8,
    shadowColor: colors.shadow,
    boxShadow: `0px 1px 2px ${colors.shadow}`,
    elevation: 1,
  },
  cardFocused: {
    borderColor: colors.accent,
  },
  header: {
    gap: 2,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.muted,
    textTransform: "uppercase",
  },
  officeTitle: {
    fontSize: 14,
    color: colors.text,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  party: {
    fontSize: 13,
    color: colors.muted,
  },
  contactSection: {
    gap: 10,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactRow: {
    gap: 2,
  },
  contactLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contactValues: {
    gap: 1,
  },
  contactValue: {
    fontSize: 14,
    color: colors.text,
  },
  notListed: {
    fontSize: 14,
    color: colors.muted,
    fontStyle: "italic",
  },
  verified: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
});
