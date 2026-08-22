/**
 * The menu drawer, drawn natively.
 *
 * It used to be the website's own drawer, revealed inside the WebView by CSS.
 * That worked, but it was the one place in the app where the phone was showing
 * a desktop theme's idea of a menu: full width, with branches that expanded
 * downwards so that opening Dogs pushed Cats off the screen and left the
 * customer scrolling a page-long accordion to find their way back.
 *
 * This is the same menu -- every row still comes from zigly.com, read by
 * ../webview/menuBridge.ts -- with the three things the reference app does and
 * the web drawer could not:
 *
 *   **Two thirds of the screen.** The page stays visible in the last third, so
 *   the drawer reads as something laid over the store rather than a new page.
 *
 *   **Drill-down, not accordion.** Tapping Dogs slides its categories in from
 *   the right with the parent's name and a back arrow above them. One level is
 *   on screen at a time, so a list is never longer than the phone.
 *
 *   **A scrim that closes it.** Tapping the visible sliver of the page is the
 *   gesture everyone tries first, and it now does what it looks like it does.
 *
 * The account block at the top is the app's own session state -- the same
 * `auth` and `customer` the Account screen renders -- not a fifth copy of it.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {COLORS, FONT_FAMILY} from '../constants/appConstants';
import type {AuthState, Customer} from '../account/accountData';
import type {MenuNode} from '../menu/menuTree';
import {isDrawableIcon, levelsFor, nodesFor} from '../menu/menuTree';
import {ChevronRight, PersonIcon} from './glyphs';

/** How much of the screen the panel takes. The rest stays the store. */
const PANEL_FRACTION = 2 / 3;

const OPEN_MS = 240;
const CLOSE_MS = 190;
const LEVEL_MS = 230;

export interface MenuDrawerHandle {
  /**
   * One step back: out of a sub-level, or false when already at the top.
   *
   * The hardware Back button needs this, and the level state lives here rather
   * than in the screen because backing out is an animation, not a state change:
   * the level being left has to stay on screen until it has slid off it.
   */
  stepBack: () => boolean;
}

interface Props {
  open: boolean;
  /** The site's menu, as read from the page. Empty until the first reply. */
  items: MenuNode[];
  auth: AuthState;
  /** null until the account probe answers, and whenever nobody is signed in. */
  customer: Customer | null;
  onClose: () => void;
  /** A leaf was tapped. The url is absolute and may be `tel:` or `mailto:`. */
  onNavigate: (url: string) => void;
  /** The account block was tapped. */
  onAccountPress: () => void;
}

const MenuDrawer = forwardRef<MenuDrawerHandle, Props>(
  ({open, items, auth, customer, onClose, onNavigate, onAccountPress}, ref) => {
    const {width} = useWindowDimensions();
    const panelWidth = Math.round(width * PANEL_FRACTION);

    /**
     * Mounted separately from `open` so the close animation has something to
     * animate. Nothing under here is expensive enough to be worth keeping
     * alive once it has gone.
     */
    const [mounted, setMounted] = useState(open);
    const slide = useRef(new Animated.Value(open ? 1 : 0)).current;

    /**
     * The open path, held as ids rather than nodes: the hamburger re-reads the
     * page on every tap, and a fresh tree must not collapse the level the
     * customer is looking at.
     */
    const [path, setPath] = useState<string[]>([]);
    const pathRef = useRef<string[]>([]);
    const depth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      pathRef.current = path;
    }, [path]);

    const levels = useMemo(() => levelsFor(items, path), [items, path]);
    const trail = useMemo(() => nodesFor(items, path), [items, path]);

    // A re-read can retire a branch the drawer was standing in. Follow the tree
    // back down to wherever it still goes rather than showing a blank level.
    const reachable = levels.length - 1;
    useEffect(() => {
      if (reachable < pathRef.current.length) {
        setPath(prev => prev.slice(0, reachable));
        depth.setValue(reachable);
      }
    }, [reachable, depth]);

    useEffect(() => {
      if (open) {
        setMounted(true);
      }
      Animated.timing(slide, {
        toValue: open ? 1 : 0,
        duration: open ? OPEN_MS : CLOSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished && !open) {
          setMounted(false);
          // Next time it opens, it opens at the top of the menu.
          setPath([]);
          depth.setValue(0);
        }
      });
    }, [open, slide, depth]);

    const enter = useCallback(
      (node: MenuNode) => {
        const next = [...pathRef.current, node.id];
        pathRef.current = next;
        setPath(next);
        Animated.timing(depth, {
          toValue: next.length,
          duration: LEVEL_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
      [depth],
    );

    const stepBack = useCallback((): boolean => {
      const current = pathRef.current;
      if (current.length === 0) {
        return false;
      }
      // Trimmed only once the level has finished sliding off; dropping it now
      // would shrink the row of levels under the transform mid-animation.
      const next = current.slice(0, -1);
      pathRef.current = next;
      Animated.timing(depth, {
        toValue: next.length,
        duration: LEVEL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) {
          setPath(next);
        }
      });
      return true;
    }, [depth]);

    useImperativeHandle(ref, () => ({stepBack}), [stepBack]);

    const tapRow = useCallback(
      (node: MenuNode) => {
        if (node.children.length > 0) {
          enter(node);
          return;
        }
        if (node.href) {
          onNavigate(node.href);
        }
      },
      [enter, onNavigate],
    );

    if (!mounted) {
      return null;
    }

    const signedIn = auth === 'signedIn';
    const name = customer?.name ?? '';
    const contact = customer?.email || customer?.phone || '';

    return (
      <View style={styles.root}>
        {/*
          The scrim covers the whole body, not just the sliver beside the panel:
          the panel is drawn over it, and a scrim that stopped at the panel's
          edge would leave the page tappable through any gap a rounded corner or
          a rotation opened up.
        */}
        <Animated.View
          style={[styles.scrim, {opacity: Animated.multiply(slide, 0.45)}]}
        />
        <Pressable
          style={styles.scrimTouch}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />

        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-panelWidth, 0],
                  }),
                },
              ],
            },
          ]}>
          <Pressable
            style={({pressed}) => [styles.account, pressed && styles.pressed]}
            onPress={onAccountPress}
            accessibilityRole="button"
            accessibilityLabel={signedIn ? 'Account' : 'Login or register'}>
            <View style={styles.avatar}>
              {signedIn && customer?.initials ? (
                <Text style={styles.initials}>{customer.initials}</Text>
              ) : (
                <PersonIcon size={22} color={COLORS.white} />
              )}
            </View>
            <View style={styles.who}>
              <Text style={styles.accountName} numberOfLines={1}>
                {signedIn ? (name ? `Hi, ${name}` : 'My Account') : 'Login/Register'}
              </Text>
              {signedIn && contact ? (
                <Text style={styles.accountContact} numberOfLines={1}>
                  {contact}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={13} color="#6B7688" />
          </Pressable>

          {items.length === 0 ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={COLORS.navy} />
            </View>
          ) : (
            <View style={styles.levelClip}>
              <Animated.View
                style={[
                  styles.levelRow,
                  {
                    width: panelWidth * levels.length,
                    transform: [
                      {translateX: Animated.multiply(depth, -panelWidth)},
                    ],
                  },
                ]}>
                {levels.map((level, index) => (
                  <View
                    key={index === 0 ? 'root' : path[index - 1]}
                    style={[styles.level, {width: panelWidth}]}>
                    {index > 0 ? (
                      <Pressable
                        style={({pressed}) => [
                          styles.levelHead,
                          pressed && styles.pressed,
                        ]}
                        onPress={stepBack}
                        accessibilityRole="button"
                        accessibilityLabel="Back">
                        <View style={styles.backArrow}>
                          <ChevronRight size={13} color={COLORS.navy} />
                        </View>
                        <Text style={styles.levelTitle} numberOfLines={1}>
                          {trail[index - 1]?.label ?? ''}
                        </Text>
                      </Pressable>
                    ) : null}
                    <ScrollView
                      contentContainerStyle={styles.levelScroll}
                      showsVerticalScrollIndicator={false}>
                      {level.map(node => (
                        <Pressable
                          key={node.id}
                          style={({pressed}) => [
                            styles.row,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => tapRow(node)}
                          accessibilityRole="button"
                          accessibilityLabel={node.label}>
                          {isDrawableIcon(node.icon) ? (
                            <Image
                              source={{uri: node.icon as string}}
                              style={styles.rowIcon}
                              resizeMode="contain"
                            />
                          ) : null}
                          <Text
                            style={[
                              styles.rowLabel,
                              node.accent ? {color: node.accent} : null,
                            ]}
                            numberOfLines={2}>
                            {node.label}
                          </Text>
                          {node.children.length > 0 ? (
                            <ChevronRight size={13} color="#8A94A6" />
                          ) : null}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </View>
    );
  },
);

MenuDrawer.displayName = 'MenuDrawer';

const styles = StyleSheet.create({
  root: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  scrimTouch: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},

  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.ground,
    // Android's shadow; the panel needs an edge against the page behind it.
    elevation: 16,
  },

  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#EFF1F5',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9AA7B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: FONT_FAMILY,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  who: {flex: 1, minWidth: 0, gap: 1},
  accountName: {
    fontFamily: FONT_FAMILY,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1B1B1B',
  },
  accountContact: {
    fontFamily: FONT_FAMILY,
    fontSize: 12.5,
    color: '#4A5361',
  },

  waiting: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  /** Clips the level to the panel, so the one off to the right is not drawn. */
  levelClip: {flex: 1, overflow: 'hidden'},
  levelRow: {flex: 1, flexDirection: 'row'},
  level: {flex: 1},
  levelScroll: {paddingBottom: 28},

  levelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  /** The one chevron in this app that points left. */
  backArrow: {transform: [{rotate: '180deg'}]},
  levelTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY,
    fontSize: 15.5,
    fontWeight: '700',
    color: COLORS.navy,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F6',
  },
  rowIcon: {width: 24, height: 24},
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONT_FAMILY,
    fontSize: 14.5,
    fontWeight: '500',
    color: '#1B1B1B',
  },
  pressed: {opacity: 0.65},
});

export default MenuDrawer;
