import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	Calendar as CalendarIcon,
	Clock,
	Crosshair,
	DollarSign,
	Edit,
	Filter,
	Heart,
	MapPin,
	Plus,
	Reply,
	Send,
	Settings,
	Share2,
	Tag,
	User,
	UserMinus,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	type CommentModel,
	CommentORM,
} from "@/components/data/orm/orm_comment";
import { type EventModel, EventORM } from "@/components/data/orm/orm_event";
import {
	type FriendshipModel,
	FriendshipORM,
	FriendshipStatus,
} from "@/components/data/orm/orm_friendship";
import { NotificationORM } from "@/components/data/orm/orm_notification";
import { type RsvpModel, RsvpORM } from "@/components/data/orm/orm_rsvp";
// Import data layer
import { type UserModel, UserORM } from "@/components/data/orm/orm_user";

import { useCreaoFileUpload } from "@/hooks/use-creao-file-upload";
import { useGmailSendEmail } from "@/hooks/use-gmail-send-email";
import { useGoogleCalendarCreateEvent } from "@/hooks/use-google-calendar-create-event";
// Import hooks
import { type LatLng, useGoogleMaps } from "@/hooks/use-google-maps";
import { useOpenAIEventTagging } from "@/hooks/use-openai-event-tagging";

export const Route = createFileRoute("/")({
	component: App,
});

// Event types available
const EVENT_TYPES = [
	"recruiting",
	"freebies",
	"product_promotion",
	"concerts",
	"parties",
	"festivals",
	"company_events",
	"hobbyist_events",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

// Helper function to get map marker icon based on event type
function getMarkerIcon(eventType: string): string {
	const iconMap: Record<string, string> = {
		recruiting: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
		freebies: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
		concerts: "http://maps.google.com/mapfiles/ms/icons/purple-dot.png",
		company_events: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
		parties: "http://maps.google.com/mapfiles/ms/icons/pink-dot.png",
		hobbyist_events: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
		festivals: "http://maps.google.com/mapfiles/ms/icons/purple-dot.png",
		product_promotion:
			"http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
	};

	return (
		iconMap[eventType] || "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
	);
}

function App() {
	// Authentication state
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [currentUser, setCurrentUser] = useState<UserModel | null>(null);
	const [showAuthDialog, setShowAuthDialog] = useState(true);
	const [authMode, setAuthMode] = useState<"login" | "signup">("login");
	const [showOnboarding, setShowOnboarding] = useState(false);

	// Auth form state
	const [authEmail, setAuthEmail] = useState("");
	const [authPassword, setAuthPassword] = useState("");
	const [authUsername, setAuthUsername] = useState("");

	// Map state
	const mapContainerRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/suspicious/noExplicitAny: Google Maps API returns untyped map instance
	const [mapInstance, setMapInstance] = useState<any>(null);
	const [userLocation, setUserLocation] = useState<LatLng | null>(null);
	const [events, setEvents] = useState<EventModel[]>([]);
	const [selectedEvent, setSelectedEvent] = useState<EventModel | null>(null);

	// Filter state
	const [showFilters, setShowFilters] = useState(false);
	const [filterDate, setFilterDate] = useState<Date>();
	const [filterTypes, setFilterTypes] = useState<EventType[]>([]);
	const [filterPrice, setFilterPrice] = useState<"free" | "paid" | "all">(
		"all",
	);

	// Event creation state
	const [showCreateEvent, setShowCreateEvent] = useState(false);
	const [eventTitle, setEventTitle] = useState("");
	const [eventDescription, setEventDescription] = useState("");
	const [eventLocation, setEventLocation] = useState("");
	const [eventStartDate, setEventStartDate] = useState<Date>();
	const [eventStartTime, setEventStartTime] = useState("12:00");
	const [eventEndDate, setEventEndDate] = useState<Date>();
	const [eventEndTime, setEventEndTime] = useState("13:00");
	const [eventType, setEventType] = useState<EventType>("concerts");
	const [eventPrice, setEventPrice] = useState("");
	const [eventAge, setEventAge] = useState("");
	const [eventPhoto, setEventPhoto] = useState<File | null>(null);
	const [useCurrentLocation, setUseCurrentLocation] = useState(false);
	const [locationSuggestions, setLocationSuggestions] = useState<
		Array<{ description: string; place_id: string }>
	>([]);
	const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
	const locationInputRef = useRef<HTMLInputElement>(null);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [userTimezone, setUserTimezone] = useState<string>(
		Intl.DateTimeFormat().resolvedOptions().timeZone,
	);

	// Event editing state
	const [showEditEvent, setShowEditEvent] = useState(false);
	const [editingEvent, setEditingEvent] = useState<EventModel | null>(null);

	// Settings state
	const [showSettings, setShowSettings] = useState(false);
	const [emailNotifications, setEmailNotifications] = useState(true);
	const [selectedPreferences, setSelectedPreferences] = useState<EventType[]>(
		[],
	);

	// Friend management
	const [friendEmail, setFriendEmail] = useState("");
	const [friends, setFriends] = useState<UserModel[]>([]);
	const [pendingRequests, setPendingRequests] = useState<
		Array<{ friendship: FriendshipModel; user: UserModel }>
	>([]);
	const [emailError, setEmailError] = useState("");

	// Comments
	const [commentText, setCommentText] = useState("");
	const [comments, setComments] = useState<CommentModel[]>([]);
	const [replyingTo, setReplyingTo] = useState<string | null>(null);
	const [replyText, setReplyText] = useState("");

	// RSVP tracking
	const [userRSVPs, setUserRSVPs] = useState<RsvpModel[]>([]);
	const [friendRSVPs, setFriendRSVPs] = useState<RsvpModel[]>([]);

	// Store formatted addresses for events (eventId -> formatted address)
	const [eventAddresses, setEventAddresses] = useState<Record<string, string>>(
		{},
	);

	// Draggable overlay height state
	const [overlayHeight, setOverlayHeight] = useState(33); // percentage of screen height
	const [isDragging, setIsDragging] = useState(false);
	const [dragStartY, setDragStartY] = useState(0);
	const [dragStartHeight, setDragStartHeight] = useState(33);

	// Google Maps API key
	const GOOGLE_MAPS_API_KEY =
		import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
		"AIzaSyDYqM1hHxtg4pLSe2-v0Q1Njvn-JEN_xGQ";

	// Initialize hooks
	const {
		isLoaded: isMapsLoaded,
		loadError: mapsLoadError,
		createMap,
		createMarker,
		geocode,
		reverseGeocode,
		getCurrentLocation,
		google,
	} = useGoogleMaps({
		apiKey: GOOGLE_MAPS_API_KEY,
		libraries: ["places"],
	});

	const tagEventMutation = useOpenAIEventTagging();
	const uploadFileMutation = useCreaoFileUpload();
	const sendEmailMutation = useGmailSendEmail();
	const createCalendarEventMutation = useGoogleCalendarCreateEvent();

	// Initialize ORMs
	const userORM = UserORM.getInstance();
	const eventORM = EventORM.getInstance();
	const rsvpORM = RsvpORM.getInstance();
	const friendshipORM = FriendshipORM.getInstance();
	const commentORM = CommentORM.getInstance();
	const notificationORM = NotificationORM.getInstance();

	// Helper function to safely format dates
	const safeFormatDate = (dateString: string, formatStr: string): string => {
		if (!dateString) return "Just now";
		const date = new Date(dateString);
		if (Number.isNaN(date.getTime())) return "Just now";
		return format(date, formatStr);
	};

	// Helper function to get badge styling based on event type
	const getEventTypeBadgeClass = (eventType: string): string => {
		switch (eventType) {
			case "freebies":
				return "bg-green-100 text-green-800 hover:bg-green-100";
			case "recruiting":
				return "bg-red-100 text-red-800 hover:bg-red-100";
			default:
				return "";
		}
	};

	// Helper function to get map pin color based on event type
	const getMapPinColor = (eventType: string): string => {
		switch (eventType) {
			case "freebies":
				return "text-green-600";
			case "recruiting":
				return "text-red-600";
			default:
				return "";
		}
	};

	// Helper function to get formatted address from coordinates
	const getFormattedAddress = async (
		lat: number,
		lng: number,
	): Promise<string> => {
		try {
			const result = await reverseGeocode.mutateAsync({
				lat,
				lng,
			});
			return result.formattedAddress;
		} catch (error) {
			console.error("Error reverse geocoding:", error);
			return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
		}
	};

	// Load user location
	useEffect(() => {
		if (isAuthenticated && !userLocation) {
			getCurrentLocation()
				.then((location) => {
					setUserLocation(location);
					if (currentUser) {
						userORM.setUserById(currentUser.id, {
							...currentUser,
							current_latitude: location.lat,
							current_longitude: location.lng,
						});
					}
				})
				.catch((error) => {
					console.error("Failed to get location:", error);
					// Use default location (San Francisco) as fallback
					const defaultLocation = { lat: 37.7749, lng: -122.4194 };
					setUserLocation(defaultLocation);
					toast.error(
						"Could not access your location. Using default location.",
					);
				});
		}
	}, [isAuthenticated, userLocation, currentUser, getCurrentLocation, userORM]);

	// Initialize map with enhanced full-screen interactivity
	useEffect(() => {
		if (
			isMapsLoaded &&
			mapContainerRef.current &&
			!mapInstance &&
			userLocation
		) {
			// Create map with basic config
			const map = createMap(mapContainerRef.current, {
				center: userLocation,
				zoom: 14,
			});

			// Enhance map with additional controls via Google Maps API
			if (map && window.google?.maps) {
				// Enable gesture handling for smooth scrolling/zooming without ctrl key
				map.setOptions({
					gestureHandling: "greedy",
					zoomControl: true,
					mapTypeControl: true,
					streetViewControl: true,
					fullscreenControl: true,
					styles: [
						{
							featureType: "poi",
							elementType: "labels",
							stylers: [{ visibility: "on" }],
						},
					],
				});
			}

			setMapInstance(map);

			// Create a marker for user's current location
			createMarker(map, {
				position: userLocation,
				title: "Your Location",
				icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
			});
		}
	}, [isMapsLoaded, mapInstance, userLocation, createMap, createMarker]);

	// Load events
	useEffect(() => {
		if (isAuthenticated) {
			loadEvents();
			loadUserRSVPs();
			loadFriendRSVPs();
		}
	}, [isAuthenticated]);

	// Handle shared event links - parse URL for event parameter
	useEffect(() => {
		if (isAuthenticated && events.length > 0) {
			const urlParams = new URLSearchParams(window.location.search);
			const sharedEventId = urlParams.get("event");

			if (sharedEventId) {
				const sharedEvent = events.find((e) => e.id === sharedEventId);
				if (sharedEvent) {
					// Wait a bit to ensure the map markers are loaded
					setTimeout(() => {
						setSelectedEvent(sharedEvent);
						loadEventComments(sharedEvent.id);
					}, 100);
					// Clean up URL without reloading the page
					window.history.replaceState(
						{},
						document.title,
						window.location.pathname,
					);
				} else {
					// Event not found, clean up URL
					window.history.replaceState(
						{},
						document.title,
						window.location.pathname,
					);
					toast.error("Event not found or no longer available");
				}
			}
		}
	}, [isAuthenticated, events]);

	// Update map markers - only show filtered events
	useEffect(() => {
		if (mapInstance && events.length > 0 && window.google?.maps) {
			// Clear all existing markers by creating a new map overlay
			// We need to track markers to clear them
			// biome-ignore lint/suspicious/noExplicitAny: Google Maps API returns untyped marker instances
			const markers: any[] = [];

			// Filter events inline to properly track dependencies
			const now = new Date();
			const filtered = events.filter((event) => {
				// Always show current and upcoming events (events that haven't ended yet)
				const eventEndTime = new Date(event.end_datetime);
				if (eventEndTime < now) {
					return false; // Don't show past events
				}

				if (
					filterDate &&
					format(new Date(event.start_datetime), "yyyy-MM-dd") !==
						format(filterDate, "yyyy-MM-dd")
				) {
					return false;
				}
				if (
					filterTypes.length > 0 &&
					!filterTypes.includes(event.event_type as EventType)
				) {
					return false;
				}
				if (filterPrice === "free" && event.price > 0) {
					return false;
				}
				if (filterPrice === "paid" && event.price === 0) {
					return false;
				}
				return true;
			});

			for (const event of filtered) {
				const icon = getMarkerIcon(event.event_type);

				const marker = createMarker(mapInstance, {
					position: { lat: event.latitude, lng: event.longitude },
					title: event.title,
					icon,
					onClick: () => {
						setComments([]); // Clear comments before loading new event
						setSelectedEvent(event);
						loadEventComments(event.id);
					},
				});

				if (marker) {
					markers.push(marker);
				}
			}

			// Cleanup function to remove markers when filters change
			return () => {
				for (const marker of markers) {
					if (marker?.setMap) {
						marker.setMap(null);
					}
				}
			};
		}
	}, [mapInstance, events, filterDate, filterTypes, filterPrice, createMarker]);

	// Close location suggestions when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				locationInputRef.current &&
				!locationInputRef.current.contains(event.target as Node)
			) {
				setShowLocationSuggestions(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	// Auth handler
	const handleAuth = async () => {
		if (authMode === "signup") {
			const hashedPassword = btoa(authPassword);
			const newUsers = await userORM.insertUser([
				{
					id: "",
					data_creator: "",
					data_updater: "",
					create_time: "",
					update_time: "",
					email: authEmail,
					password_hash: hashedPassword,
					username: authUsername,
					event_preference: [],
					notification_setting: {
						weekly_summary: true,
						event_created: true,
						event_cancelled: true,
					},
					events_attended_count: 0,
					events_hosted_count: 0,
				},
			]);

			setCurrentUser(newUsers[0]);
			setIsAuthenticated(true);
			setShowAuthDialog(false);
			setShowOnboarding(true);
			toast.success("Account created successfully!");
		} else {
			const [users] = await userORM.listUser();
			const user = users.find((u) => u.email === authEmail);

			if (user && user.password_hash === btoa(authPassword)) {
				setCurrentUser(user);
				setIsAuthenticated(true);
				setShowAuthDialog(false);
				setSelectedPreferences((user.event_preference || []) as EventType[]);
				toast.success("Logged in successfully!");
			} else {
				toast.error("Invalid email or password");
			}
		}
	};

	// Save preferences
	const handleSavePreferences = async () => {
		if (currentUser) {
			const updatedUser = {
				...currentUser,
				event_preference: selectedPreferences,
			};
			await userORM.setUserById(currentUser.id, updatedUser);
			setCurrentUser(updatedUser); // Update local state immediately
			setShowOnboarding(false);
			toast.success("Preferences saved!");
		}
	};

	// Load events
	const loadEvents = async () => {
		const [allEvents] = await eventORM.listEvent();
		setEvents(allEvents);

		// Convert coordinates to formatted addresses for events that need it
		const addressMap: Record<string, string> = {};
		for (const event of allEvents) {
			// Check if location_address looks like coordinates (contains numbers and comma)
			if (
				event.location_address &&
				/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(event.location_address.trim())
			) {
				try {
					const formattedAddr = await getFormattedAddress(
						event.latitude,
						event.longitude,
					);
					addressMap[event.id] = formattedAddr;
				} catch (error) {
					console.error("Error formatting address for event:", event.id, error);
					addressMap[event.id] = event.location_address;
				}
			} else {
				addressMap[event.id] = event.location_address;
			}
		}
		setEventAddresses(addressMap);
	};

	// Load friends
	const loadFriends = useCallback(async () => {
		if (!currentUser) return;
		const [friendships] = await friendshipORM.listFriendship();

		// Load accepted friends (bidirectional - where current user is either user_id or friend_id)
		const acceptedFriendships = friendships.filter(
			(f) =>
				(f.user_id === currentUser.id || f.friend_id === currentUser.id) &&
				f.status === FriendshipStatus.Accepted,
		);

		const friendUsersArrays = await Promise.all(
			acceptedFriendships.map((f) =>
				userORM.getUserById(
					f.user_id === currentUser.id ? f.friend_id : f.user_id,
				),
			),
		);
		const friendUsers = friendUsersArrays
			.flat()
			.filter((u): u is UserModel => u !== null);
		setFriends(friendUsers);

		// Load pending friend requests (where current user is friend_id and status is pending)
		const pendingFriendships = friendships.filter(
			(f) =>
				f.friend_id === currentUser.id && f.status === FriendshipStatus.Pending,
		);

		const pendingUsersArrays = await Promise.all(
			pendingFriendships.map(async (f) => {
				const users = await userORM.getUserById(f.user_id);
				return { friendship: f, user: users[0] };
			}),
		);
		const pendingData = pendingUsersArrays.filter(
			(p): p is { friendship: FriendshipModel; user: UserModel } => !!p.user,
		);
		setPendingRequests(pendingData);
	}, [currentUser, friendshipORM, userORM]);

	// Load friends on settings open
	useEffect(() => {
		if (showSettings && isAuthenticated) {
			loadFriends();
		}
	}, [showSettings, isAuthenticated, loadFriends]);

	// Load user RSVPs
	const loadUserRSVPs = async () => {
		if (!currentUser) return;
		const [allRSVPs] = await rsvpORM.listRsvp();
		const myRSVPs = allRSVPs.filter((r) => r.user_id === currentUser.id);
		setUserRSVPs(myRSVPs);
	};

	// Load friend RSVPs
	const loadFriendRSVPs = async () => {
		if (!currentUser) return;

		// Load all friendships and RSVPs
		const [friendships] = await friendshipORM.listFriendship();
		const [allRSVPs] = await rsvpORM.listRsvp();

		// Get accepted friends (bidirectional - where current user is either user_id or friend_id)
		const acceptedFriendships = friendships.filter(
			(f) =>
				(f.user_id === currentUser.id || f.friend_id === currentUser.id) &&
				f.status === FriendshipStatus.Accepted,
		);

		// Extract friend IDs
		const friendIds = acceptedFriendships.map((f) =>
			f.user_id === currentUser.id ? f.friend_id : f.user_id,
		);

		// Get RSVPs from all friends
		const friendsRSVPs = allRSVPs.filter((r) => friendIds.includes(r.user_id));
		setFriendRSVPs(friendsRSVPs);
	};

	// Helper to get friends going to an event
	const getFriendsGoingToEvent = (eventId: string): UserModel[] => {
		const rsvpsForEvent = friendRSVPs.filter((r) => r.event_id === eventId);
		const friendIdsGoing = rsvpsForEvent.map((r) => r.user_id);
		return friends.filter((f) => friendIdsGoing.includes(f.id));
	};

	// Create event
	const handleCreateEvent = async () => {
		// Validate required fields
		const errors: string[] = [];

		if (!eventTitle.trim()) {
			errors.push("Event Title");
		}
		if (!eventDescription.trim()) {
			errors.push("Description");
		}
		if (!useCurrentLocation && !eventLocation.trim()) {
			errors.push("Location");
		}
		if (!eventStartDate) {
			errors.push("Start Date & Time");
		}

		if (errors.length > 0) {
			setValidationErrors(errors);
			toast.error("Please fill in all required fields");
			return;
		}

		// Clear validation errors
		setValidationErrors([]);

		if (!currentUser || !eventStartDate) {
			toast.error("Please log in to create an event");
			return;
		}

		// Combine date and time for start
		const [startHours, startMinutes] = eventStartTime.split(":").map(Number);
		const startDateTime = new Date(eventStartDate);
		startDateTime.setHours(startHours, startMinutes, 0, 0);

		// Combine date and time for end, or default to 1 hour after start
		let endDateTime: Date;
		if (eventEndDate && eventEndTime) {
			const [endHours, endMinutes] = eventEndTime.split(":").map(Number);
			endDateTime = new Date(eventEndDate);
			endDateTime.setHours(endHours, endMinutes, 0, 0);
		} else {
			endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
		}

		// Validate that end time is after start time
		if (endDateTime.getTime() <= startDateTime.getTime()) {
			setValidationErrors(["End date/time must be after start date/time"]);
			toast.error("End date/time must be after start date/time");
			return;
		}

		try {
			let photoUrl = "";

			if (eventPhoto) {
				try {
					const uploadResult = await uploadFileMutation.mutateAsync({
						file: eventPhoto,
					});
					photoUrl = uploadResult.fileUrl;
				} catch (error) {
					console.error("Error uploading photo:", error);
					toast.error(
						"Failed to upload event photo. Please try a different image.",
					);
					return;
				}
			}

			let latitude = userLocation?.lat || 0;
			let longitude = userLocation?.lng || 0;

			if (!useCurrentLocation && eventLocation) {
				try {
					const geocodeResult = await geocode.mutateAsync({
						address: eventLocation,
					});
					latitude = geocodeResult.location.lat;
					longitude = geocodeResult.location.lng;
				} catch (error) {
					console.error("Error geocoding location:", error);
					toast.error(
						"Failed to find the location. Please check the address and try again.",
					);
					return;
				}
			}

			let taggingResult: { tags: string[] };
			try {
				taggingResult = await tagEventMutation.mutateAsync({
					eventDescription: eventDescription,
				});
			} catch (error) {
				console.error("Error tagging event:", error);
				// Non-critical error, continue with empty tags
				taggingResult = { tags: [] };
				toast.info("Event will be created without AI tags.");
			}

			let newEvents: EventModel[];
			try {
				newEvents = await eventORM.insertEvent([
					{
						id: "",
						data_creator: "",
						data_updater: "",
						create_time: "",
						update_time: "",
						title: eventTitle,
						description: eventDescription,
						location_address: useCurrentLocation
							? "Current Location"
							: eventLocation,
						latitude,
						longitude,
						start_datetime: startDateTime.toISOString(),
						end_datetime: endDateTime.toISOString(),
						event_type: eventType,
						organizer_id: currentUser.id,
						photo_url: photoUrl,
						tag: taggingResult.tags,
						price: Number.parseFloat(eventPrice) || 0,
						age_requirement: Number.parseInt(eventAge) || 0,
						is_popular: false,
					},
				]);
			} catch (error) {
				console.error("Error inserting event to database:", error);
				toast.error("Failed to save event to database. Please try again.");
				return;
			}

			// Auto-RSVP the event creator
			const createdEvent = newEvents[0];
			try {
				await rsvpORM.insertRsvp([
					{
						id: "",
						data_creator: "",
						data_updater: "",
						create_time: "",
						update_time: "",
						user_id: currentUser.id,
						event_id: createdEvent.id,
						rsvp_at: new Date().toISOString(),
						calendar_added: true,
					},
				]);
			} catch (error) {
				console.error("Error creating auto-RSVP:", error);
				// Non-critical, event is still created
				toast.warning("Event created but auto-RSVP failed.");
			}

			// Send Google Calendar invite to event creator
			const durationMs = endDateTime.getTime() - startDateTime.getTime();
			const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
			const durationMinutes = Math.floor(
				(durationMs % (1000 * 60 * 60)) / (1000 * 60),
			);

			try {
				await createCalendarEventMutation.mutateAsync({
					start_datetime: startDateTime.toISOString().slice(0, 19),
					summary: eventTitle,
					description: eventDescription,
					location: useCurrentLocation ? "Current Location" : eventLocation,
					timezone: userTimezone,
					event_duration_hour: durationHours,
					event_duration_minutes: durationMinutes,
				});
			} catch (error) {
				console.error("Error creating calendar event:", error);
				// Non-critical, event is still created
				toast.warning("Event created but calendar invite failed to send.");
			}

			try {
				await userORM.setUserById(currentUser.id, {
					...currentUser,
					events_hosted_count: currentUser.events_hosted_count + 1,
					events_attended_count: currentUser.events_attended_count + 1,
				});
			} catch (error) {
				console.error("Error updating user stats:", error);
				// Non-critical, event is still created
			}

			await loadEvents();
			await loadUserRSVPs();
			await loadFriendRSVPs();

			setShowCreateEvent(false);
			setEventTitle("");
			setEventDescription("");
			setEventLocation("");
			setEventStartDate(undefined);
			setEventStartTime("12:00");
			setEventEndDate(undefined);
			setEventEndTime("13:00");
			setEventPhoto(null);

			toast.success("Event created successfully! Calendar invite sent.");
		} catch (error) {
			console.error("Unexpected error creating event:", error);
			toast.error(
				`Failed to create event: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	};

	// Open event for editing
	const handleOpenEditEvent = (event: EventModel) => {
		setEditingEvent(event);
		setEventTitle(event.title);
		setEventDescription(event.description);
		setEventLocation(event.location_address);

		// Parse start date and time
		const startDate = new Date(event.start_datetime);
		setEventStartDate(startDate);
		setEventStartTime(
			`${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
		);

		// Parse end date and time
		const endDate = new Date(event.end_datetime);
		setEventEndDate(endDate);
		setEventEndTime(
			`${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`,
		);

		setEventType(event.event_type as EventType);
		setEventPrice(event.price.toString());
		setEventAge(event.age_requirement?.toString() || "");
		setEventPhoto(null);
		setUseCurrentLocation(event.location_address === "Current Location");
		setValidationErrors([]);
		setShowEditEvent(true);
	};

	// Update event
	const handleUpdateEvent = async () => {
		// Validate required fields
		const errors: string[] = [];

		if (!eventTitle.trim()) {
			errors.push("Event Title");
		}
		if (!eventDescription.trim()) {
			errors.push("Description");
		}
		if (!useCurrentLocation && !eventLocation.trim()) {
			errors.push("Location");
		}
		if (!eventStartDate) {
			errors.push("Start Date & Time");
		}

		if (errors.length > 0) {
			setValidationErrors(errors);
			toast.error("Please fill in all required fields");
			return;
		}

		// Clear validation errors
		setValidationErrors([]);

		if (!currentUser || !eventStartDate || !editingEvent) {
			toast.error("Missing required information");
			return;
		}

		// Combine date and time for start
		const [startHours, startMinutes] = eventStartTime.split(":").map(Number);
		const startDateTime = new Date(eventStartDate);
		startDateTime.setHours(startHours, startMinutes, 0, 0);

		// Combine date and time for end, or default to 1 hour after start
		let endDateTime: Date;
		if (eventEndDate && eventEndTime) {
			const [endHours, endMinutes] = eventEndTime.split(":").map(Number);
			endDateTime = new Date(eventEndDate);
			endDateTime.setHours(endHours, endMinutes, 0, 0);
		} else {
			endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
		}

		// Validate that end time is after start time
		if (endDateTime.getTime() <= startDateTime.getTime()) {
			setValidationErrors(["End date/time must be after start date/time"]);
			toast.error("End date/time must be after start date/time");
			return;
		}

		try {
			let photoUrl = editingEvent.photo_url;

			if (eventPhoto) {
				const uploadResult = await uploadFileMutation.mutateAsync({
					file: eventPhoto,
				});
				photoUrl = uploadResult.fileUrl;
			}

			let latitude = editingEvent.latitude;
			let longitude = editingEvent.longitude;

			// Update location if changed
			if (
				!useCurrentLocation &&
				eventLocation !== editingEvent.location_address
			) {
				const geocodeResult = await geocode.mutateAsync({
					address: eventLocation,
				});
				latitude = geocodeResult.location.lat;
				longitude = geocodeResult.location.lng;
			} else if (useCurrentLocation && userLocation) {
				latitude = userLocation.lat;
				longitude = userLocation.lng;
			}

			const taggingResult = await tagEventMutation.mutateAsync({
				eventDescription: eventDescription,
			});

			const updatedEvent: EventModel = {
				...editingEvent,
				title: eventTitle,
				description: eventDescription,
				location_address: useCurrentLocation
					? "Current Location"
					: eventLocation,
				latitude,
				longitude,
				start_datetime: startDateTime.toISOString(),
				end_datetime: endDateTime.toISOString(),
				event_type: eventType,
				photo_url: photoUrl,
				tag: taggingResult.tags,
				price: Number.parseFloat(eventPrice) || 0,
				age_requirement: Number.parseInt(eventAge) || 0,
			};

			await eventORM.setEventById(editingEvent.id, updatedEvent);

			await loadEvents();

			setShowEditEvent(false);
			setEditingEvent(null);
			setEventTitle("");
			setEventDescription("");
			setEventLocation("");
			setEventStartDate(undefined);
			setEventStartTime("12:00");
			setEventEndDate(undefined);
			setEventEndTime("13:00");
			setEventPhoto(null);

			// Update selected event if it's the one being edited
			if (selectedEvent?.id === editingEvent.id) {
				setSelectedEvent(updatedEvent);
			}

			toast.success("Event updated successfully!");
		} catch (error) {
			console.error("Error updating event:", error);
			toast.error("Failed to update event");
		}
	};

	// RSVP to event (toggle functionality)
	const handleRSVP = async (event: EventModel) => {
		if (!currentUser) return;

		try {
			// PERFORMANCE FIX: Use indexed query instead of loading all RSVPs
			const existingRSVPs = await rsvpORM.getRsvpByEventIdUserId(
				event.id,
				currentUser.id,
			);
			const existingRSVP = existingRSVPs[0];

			if (existingRSVP) {
				// Cancel RSVP
				await rsvpORM.deleteRsvpById(existingRSVP.id);

				await sendEmailMutation.mutateAsync({
					recipient_email: currentUser.email,
					subject: `RSVP Cancelled: ${event.title}`,
					body: `<h2>You have cancelled your RSVP for ${event.title}</h2><p>We hope to see you at future events!</p>`,
					is_html: true,
				});

				await userORM.setUserById(currentUser.id, {
					...currentUser,
					events_attended_count: Math.max(
						0,
						currentUser.events_attended_count - 1,
					),
				});

				await loadUserRSVPs();
				await loadFriendRSVPs();
				toast.success("RSVP cancelled. Confirmation email sent.");
			} else {
				// Add RSVP
				await rsvpORM.insertRsvp([
					{
						id: "",
						data_creator: "",
						data_updater: "",
						create_time: "",
						update_time: "",
						user_id: currentUser.id,
						event_id: event.id,
						rsvp_at: new Date().toISOString(),
						calendar_added: true,
					},
				]);

				// Send confirmation email FIRST (before calendar event that might fail)
				await sendEmailMutation.mutateAsync({
					recipient_email: currentUser.email,
					subject: `RSVP Confirmed: ${event.title}`,
					body: `<h2>You're going to ${event.title}!</h2><p>${event.description}</p><p>Date: ${format(new Date(event.start_datetime), "PPP")}</p>`,
					is_html: true,
				});

				// Calculate event duration in hours and minutes
				const startTime = new Date(event.start_datetime).getTime();
				const endTime = new Date(event.end_datetime).getTime();
				const durationMs = endTime - startTime;
				const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
				const durationMinutes = Math.floor(
					(durationMs % (1000 * 60 * 60)) / (1000 * 60),
				);

				// Try to add to calendar, but don't fail RSVP if this fails
				try {
					await createCalendarEventMutation.mutateAsync({
						start_datetime: new Date(event.start_datetime)
							.toISOString()
							.slice(0, 19),
						summary: event.title,
						description: event.description,
						location: event.location_address,
						timezone: userTimezone,
						event_duration_hour: durationHours,
						event_duration_minutes: durationMinutes,
					});
					toast.success("RSVP confirmed! Event added to your calendar.");
				} catch (calendarError) {
					console.warn("Calendar event creation failed:", calendarError);
					toast.success("RSVP confirmed! (Calendar event could not be added)");
				}

				await userORM.setUserById(currentUser.id, {
					...currentUser,
					events_attended_count: currentUser.events_attended_count + 1,
				});

				await loadUserRSVPs();
				await loadFriendRSVPs();
			}
		} catch (error) {
			console.error("Error with RSVP:", error);
			toast.error("Failed to process RSVP");
		}
	};

	// Add friend
	const handleAddFriend = async () => {
		if (!currentUser || !friendEmail) return;

		try {
			const [users] = await userORM.listUser();
			const friend = users.find((u) => u.email === friendEmail);

			if (!friend) {
				setEmailError("User not found");
				toast.error("User not found");
				return;
			}

			// Clear email error if user exists
			setEmailError("");

			// Check if user is trying to add themselves
			if (friend.id === currentUser.id) {
				toast.error("You cannot add yourself as a friend");
				return;
			}

			// Check if friendship already exists (in either direction)
			const [friendships] = await friendshipORM.listFriendship();
			const existingFriendship = friendships.find(
				(f) =>
					(f.user_id === currentUser.id && f.friend_id === friend.id) ||
					(f.user_id === friend.id && f.friend_id === currentUser.id),
			);

			if (existingFriendship) {
				if (existingFriendship.status === FriendshipStatus.Accepted) {
					toast.error("Already friends with this user");
				} else {
					toast.error("Friend request already sent or pending");
				}
				return;
			}

			// Create pending friend request
			await friendshipORM.insertFriendship([
				{
					id: "",
					data_creator: "",
					data_updater: "",
					create_time: "",
					update_time: "",
					user_id: currentUser.id,
					friend_id: friend.id,
					status: FriendshipStatus.Pending,
				},
			]);

			await loadFriends();
			setFriendEmail("");
			toast.success("Friend request sent!");
		} catch (error) {
			console.error("Error adding friend:", error);
			toast.error("Failed to send friend request");
		}
	};

	// Remove friend
	const handleRemoveFriend = async (friendId: string) => {
		if (!currentUser) return;

		try {
			const [friendships] = await friendshipORM.listFriendship();
			// Find friendship in either direction
			const friendship = friendships.find(
				(f) =>
					(f.user_id === currentUser.id && f.friend_id === friendId) ||
					(f.user_id === friendId && f.friend_id === currentUser.id),
			);

			if (friendship) {
				await friendshipORM.deleteFriendshipById(friendship.id);
				await loadFriends();
				await loadFriendRSVPs(); // Refresh friend RSVPs after removing
				toast.success("Friend removed");
			}
		} catch (error) {
			console.error("Error removing friend:", error);
			toast.error("Failed to remove friend");
		}
	};

	// Accept friend request
	const handleAcceptFriendRequest = async (friendship: FriendshipModel) => {
		if (!currentUser) return;

		try {
			// Update the friendship status to Accepted
			await friendshipORM.setFriendshipById(friendship.id, {
				...friendship,
				status: FriendshipStatus.Accepted,
			});

			await loadFriends();
			await loadFriendRSVPs(); // Refresh friend RSVPs after accepting
			toast.success("Friend request accepted!");
		} catch (error) {
			console.error("Error accepting friend request:", error);
			toast.error("Failed to accept friend request");
		}
	};

	// Decline friend request
	const handleDeclineFriendRequest = async (friendshipId: string) => {
		if (!currentUser) return;

		try {
			await friendshipORM.deleteFriendshipById(friendshipId);
			await loadFriends();
			toast.success("Friend request declined");
		} catch (error) {
			console.error("Error declining friend request:", error);
			toast.error("Failed to decline friend request");
		}
	};

	// Load comments
	const loadEventComments = async (eventId: string) => {
		const [allComments] = await commentORM.listComment();
		const eventComments = allComments.filter((c) => c.event_id === eventId);
		setComments(eventComments);
	};

	// Post comment
	const handlePostComment = async () => {
		if (!currentUser || !selectedEvent || !commentText.trim()) return;

		try {
			await commentORM.insertComment([
				{
					id: "",
					data_creator: "",
					data_updater: "",
					create_time: new Date().toISOString(),
					update_time: new Date().toISOString(),
					event_id: selectedEvent.id,
					user_id: currentUser.id,
					content: commentText,
				},
			]);

			await loadEventComments(selectedEvent.id);
			setCommentText("");
			toast.success("Comment posted!");
		} catch (error) {
			console.error("Error posting comment:", error);
			toast.error("Failed to post comment");
		}
	};

	// Post reply to a comment
	const handlePostReply = async (parentCommentId: string) => {
		if (!currentUser || !selectedEvent || !replyText.trim()) return;

		try {
			// Store parent comment ID in the content with a special prefix
			const replyContent = `@reply:${parentCommentId}|${replyText}`;

			await commentORM.insertComment([
				{
					id: "",
					data_creator: "",
					data_updater: "",
					create_time: new Date().toISOString(),
					update_time: new Date().toISOString(),
					event_id: selectedEvent.id,
					user_id: currentUser.id,
					content: replyContent,
				},
			]);

			await loadEventComments(selectedEvent.id);
			setReplyText("");
			setReplyingTo(null);
			toast.success("Reply posted!");
		} catch (error) {
			console.error("Error posting reply:", error);
			toast.error("Failed to post reply");
		}
	};

	// Handle location input change with autocomplete
	const handleLocationInputChange = (value: string) => {
		setEventLocation(value);

		if (!value.trim() || !google?.maps?.places) {
			setLocationSuggestions([]);
			setShowLocationSuggestions(false);
			return;
		}

		// Use Google Places Autocomplete Service
		const service = new google.maps.places.AutocompleteService();
		service.getPlacePredictions(
			{
				input: value,
				types: ["geocode", "establishment"],
			},
			// biome-ignore lint/suspicious/noExplicitAny: Google Maps API callback types
			(predictions: any, status: any) => {
				if (
					status === google.maps.places.PlacesServiceStatus.OK &&
					predictions
				) {
					setLocationSuggestions(
						predictions.map((p: { description: string; place_id: string }) => ({
							description: p.description,
							place_id: p.place_id,
						})),
					);
					setShowLocationSuggestions(true);
				} else {
					setLocationSuggestions([]);
					setShowLocationSuggestions(false);
				}
			},
		);
	};

	// Handle location suggestion selection
	const handleSelectLocationSuggestion = (suggestion: {
		description: string;
		place_id: string;
	}) => {
		// Update the location state - this will automatically update the input via value prop
		setEventLocation(suggestion.description);
		setShowLocationSuggestions(false);
		setLocationSuggestions([]);
	};

	// Share event using Clipboard API
	const handleShareEvent = async (event: EventModel) => {
		const shareUrl = `${window.location.origin}?event=${event.id}`;

		// Check if Clipboard API is available
		if (!navigator.clipboard) {
			// Fallback for older browsers
			const textArea = document.createElement("textarea");
			textArea.value = shareUrl;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand("copy");
				toast.success("Event link copied to clipboard!");
			} catch (err) {
				toast.error("Failed to copy link");
			}
			document.body.removeChild(textArea);
			return;
		}

		// Modern Clipboard API
		try {
			await navigator.clipboard.writeText(shareUrl);
			toast.success("Event link copied to clipboard!");
		} catch (err) {
			console.error("Failed to copy:", err);
			toast.error("Failed to copy link to clipboard");
		}
	};

	// Recenter map on user location
	const handleRecenterMap = () => {
		if (mapInstance && userLocation) {
			mapInstance.setCenter(userLocation);
			mapInstance.setZoom(14);
			toast.success("Map centered on your location");
		}
	};

	// Delete event
	const handleDeleteEvent = async (event: EventModel) => {
		if (!currentUser || event.organizer_id !== currentUser.id) return;

		try {
			const [allRSVPs] = await rsvpORM.listRsvp();
			const eventRSVPs = allRSVPs.filter((r) => r.event_id === event.id);

			for (const rsvp of eventRSVPs) {
				const users = await userORM.getUserById(rsvp.user_id);
				if (users && users.length > 0) {
					await sendEmailMutation.mutateAsync({
						recipient_email: users[0].email,
						subject: `Event Cancelled: ${event.title}`,
						body: `<h2>${event.title} has been cancelled</h2><p>We're sorry, but this event is no longer happening.</p>`,
						is_html: true,
					});
				}
			}

			await eventORM.deleteEventById(event.id);
			await loadEvents();
			setSelectedEvent(null);
			toast.success("Event deleted and attendees notified");
		} catch (error) {
			console.error("Error deleting event:", error);
			toast.error("Failed to delete event");
		}
	};

	// Filter events - ensure current/upcoming events are shown
	const getFilteredEvents = () => {
		const now = new Date();
		return events.filter((event) => {
			// Always show current and upcoming events (events that haven't ended yet)
			const eventEndTime = new Date(event.end_datetime);
			if (eventEndTime < now) {
				return false; // Don't show past events
			}

			if (
				filterDate &&
				format(new Date(event.start_datetime), "yyyy-MM-dd") !==
					format(filterDate, "yyyy-MM-dd")
			) {
				return false;
			}
			if (
				filterTypes.length > 0 &&
				!filterTypes.includes(event.event_type as EventType)
			) {
				return false;
			}
			if (filterPrice === "free" && event.price > 0) {
				return false;
			}
			if (filterPrice === "paid" && event.price === 0) {
				return false;
			}
			return true;
		});
	};

	// Handle drag for resizable overlay
	const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
		setIsDragging(true);
		const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
		setDragStartY(clientY);
		setDragStartHeight(overlayHeight);
	};

	const handleDragMove = useCallback(
		(e: MouseEvent | TouchEvent) => {
			if (!isDragging) return;

			const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
			const deltaY = dragStartY - clientY;
			const viewportHeight = window.innerHeight;
			const deltaPercent = (deltaY / viewportHeight) * 100;

			// New height with constraints (min 20%, max 80%)
			const newHeight = Math.min(
				80,
				Math.max(20, dragStartHeight + deltaPercent),
			);
			setOverlayHeight(newHeight);
		},
		[isDragging, dragStartY, dragStartHeight],
	);

	const handleDragEnd = useCallback(() => {
		setIsDragging(false);
	}, []);

	// Add event listeners for drag
	useEffect(() => {
		if (isDragging) {
			const moveHandler = (e: MouseEvent | TouchEvent) => handleDragMove(e);
			const endHandler = () => handleDragEnd();

			window.addEventListener("mousemove", moveHandler);
			window.addEventListener("mouseup", endHandler);
			window.addEventListener("touchmove", moveHandler);
			window.addEventListener("touchend", endHandler);

			return () => {
				window.removeEventListener("mousemove", moveHandler);
				window.removeEventListener("mouseup", endHandler);
				window.removeEventListener("touchmove", moveHandler);
				window.removeEventListener("touchend", endHandler);
			};
		}
	}, [isDragging, handleDragMove, handleDragEnd]);

	const filteredEvents = getFilteredEvents();

	// Auth Dialog
	if (!isAuthenticated) {
		return (
			<Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>
							{authMode === "login" ? "Welcome Back" : "Create Account"}
						</DialogTitle>
						<DialogDescription>
							{authMode === "login"
								? "Sign in to discover events near you"
								: "Join us to start exploring local events"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						{authMode === "signup" && (
							<div className="space-y-2">
								<Label htmlFor="username">Username</Label>
								<Input
									id="username"
									value={authUsername}
									onChange={(e) => setAuthUsername(e.target.value)}
									placeholder="johndoe"
								/>
							</div>
						)}
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								value={authEmail}
								onChange={(e) => setAuthEmail(e.target.value)}
								placeholder="you@example.com"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={authPassword}
								onChange={(e) => setAuthPassword(e.target.value)}
								placeholder="••••••••"
							/>
						</div>
						<Button onClick={handleAuth} className="w-full">
							{authMode === "login" ? "Sign In" : "Create Account"}
						</Button>
						<Button
							variant="ghost"
							onClick={() =>
								setAuthMode(authMode === "login" ? "signup" : "login")
							}
							className="w-full"
						>
							{authMode === "login"
								? "Need an account? Sign up"
								: "Have an account? Sign in"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	// Onboarding Dialog
	if (showOnboarding) {
		return (
			<Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>What events interest you?</DialogTitle>
						<DialogDescription>
							Select the types of events you'd like to be notified about
						</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-3 py-4">
						{EVENT_TYPES.map((type) => (
							<button
								type="button"
								key={type}
								className={cn(
									"p-4 border rounded-lg cursor-pointer transition-colors",
									selectedPreferences.includes(type)
										? "border-primary bg-primary/10"
										: "border-gray-200",
								)}
								onClick={() => {
									if (selectedPreferences.includes(type)) {
										setSelectedPreferences(
											selectedPreferences.filter((t) => t !== type),
										);
									} else {
										setSelectedPreferences([...selectedPreferences, type]);
									}
								}}
							>
								<div className="font-medium capitalize">
									{type.replace("_", " ")}
								</div>
							</button>
						))}
					</div>
					<Button onClick={handleSavePreferences} className="w-full">
						Save Preferences
					</Button>
				</DialogContent>
			</Dialog>
		);
	}

	// Main App
	return (
		<div className="relative h-screen w-full overflow-hidden">
			{/* Full-Screen Interactive Map Container */}
			<div
				ref={mapContainerRef}
				className="absolute inset-0 w-full h-full"
				style={{ zIndex: 0 }}
			/>

			{/* Loading overlay while map initializes */}
			{(!isMapsLoaded || !userLocation || !mapInstance) && (
				<div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
					<div className="text-center space-y-4 max-w-md px-4">
						{mapsLoadError ? (
							<>
								<div className="text-red-500 text-4xl">⚠️</div>
								<div className="text-lg font-medium text-red-600">
									Failed to Load Maps
								</div>
								<div className="text-sm text-gray-600">
									{mapsLoadError.message}
								</div>
								<Button
									onClick={() => window.location.reload()}
									variant="outline"
								>
									Retry
								</Button>
							</>
						) : (
							<>
								<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
								<div className="text-lg font-medium">
									{!isMapsLoaded
										? "Loading maps..."
										: !userLocation
											? "Getting your location..."
											: "Initializing map..."}
								</div>
								<div className="text-sm text-gray-500">
									Check browser console for details
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{/* Top-right controls */}
			<div className="absolute top-4 right-4 z-10 flex gap-2">
				{/* Recenter Map Button */}
				<Button
					size="icon"
					variant="secondary"
					onClick={handleRecenterMap}
					title="Center map on your location"
				>
					<Crosshair className="h-4 w-4" />
				</Button>

				{/* Settings Button */}
				<Dialog open={showSettings} onOpenChange={setShowSettings}>
					<DialogTrigger asChild>
						<Button size="icon">
							<Settings className="h-4 w-4" />
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader className="space-y-3 pb-6">
							<DialogTitle className="text-xl">Account Settings</DialogTitle>
							<DialogDescription className="text-base">
								Manage your profile and preferences
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-8 py-4 pb-6">
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<User className="h-5 w-5" />
									<span className="font-medium text-lg">
										{currentUser?.username}
									</span>
								</div>
								<div className="text-sm text-gray-500 ml-8">
									{currentUser?.email}
								</div>
							</div>

							<Separator className="my-6" />

							<div className="space-y-6">
								<h3 className="font-medium text-lg">User Stats</h3>
								<div className="grid grid-cols-2 gap-6">
									<Card>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm">Events Attended</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="text-2xl font-bold">
												{currentUser?.events_attended_count}
											</div>
										</CardContent>
									</Card>
									<Card>
										<CardHeader className="pb-2">
											<CardTitle className="text-sm">Events Hosted</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="text-2xl font-bold">
												{currentUser?.events_hosted_count}
											</div>
										</CardContent>
									</Card>
								</div>
							</div>

							<Separator className="my-6" />

							<div className="space-y-6">
								<div className="space-y-2">
									<h3 className="font-medium text-lg">Event Preferences</h3>
									<p className="text-sm text-gray-500">
										Select the types of events you'd like to see with a ⭐
									</p>
								</div>
								<div className="grid grid-cols-2 gap-3">
									{EVENT_TYPES.map((type) => (
										<button
											type="button"
											key={type}
											className={cn(
												"p-3 border rounded cursor-pointer transition-colors text-left",
												selectedPreferences.includes(type)
													? "border-primary bg-primary/10"
													: "border-gray-200",
											)}
											onClick={() => {
												const newPreferences = selectedPreferences.includes(
													type,
												)
													? selectedPreferences.filter((t) => t !== type)
													: [...selectedPreferences, type];
												setSelectedPreferences(newPreferences);
												// Update user preferences immediately
												if (currentUser) {
													const updatedUser = {
														...currentUser,
														event_preference: newPreferences,
													};
													userORM.setUserById(currentUser.id, updatedUser);
													setCurrentUser(updatedUser);
												}
											}}
										>
											<div className="capitalize text-sm">
												{type.replace("_", " ")}
											</div>
										</button>
									))}
								</div>
							</div>

							<Separator className="my-6" />

							<div className="space-y-6">
								<h3 className="font-medium text-lg">Friends</h3>
								<div className="flex gap-3">
									<div className="flex-1">
										<Input
											placeholder="Friend's email"
											value={friendEmail}
											onChange={(e) => {
												setFriendEmail(e.target.value);
												setEmailError(""); // Clear error on type
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													handleAddFriend();
												}
											}}
											className={emailError ? "border-red-500" : ""}
										/>
										{emailError && (
											<p className="text-red-500 text-sm mt-2">{emailError}</p>
										)}
									</div>
									<Button size="icon" onClick={handleAddFriend}>
										<UserPlus className="h-4 w-4" />
									</Button>
								</div>

								{/* Pending Friend Requests */}
								{pendingRequests.length > 0 && (
									<div className="space-y-3">
										<h4 className="text-sm font-medium">
											Pending Friend Requests ({pendingRequests.length})
										</h4>
										<ScrollArea className="max-h-48 border rounded p-3 bg-blue-50">
											<div className="space-y-3">
												{pendingRequests.map(({ friendship, user }) => (
													<div
														key={friendship.id}
														className="flex items-center justify-between p-3 border rounded bg-white gap-3"
													>
														<div className="flex-1 min-w-0 space-y-1">
															<div className="font-medium truncate">
																{user.username}
															</div>
															<div className="text-xs text-gray-500 truncate">
																{user.email}
															</div>
														</div>
														<div className="flex gap-2 flex-shrink-0">
															<Button
																size="sm"
																variant="default"
																className="h-9 px-4"
																onClick={() =>
																	handleAcceptFriendRequest(friendship)
																}
															>
																Accept
															</Button>
															<Button
																size="sm"
																variant="outline"
																className="h-9 px-4"
																onClick={() =>
																	handleDeclineFriendRequest(friendship.id)
																}
															>
																Decline
															</Button>
														</div>
													</div>
												))}
											</div>
										</ScrollArea>
									</div>
								)}

								{/* Current Friends */}
								<div className="space-y-3">
									<h4 className="text-sm font-medium">
										Friends ({friends.length})
									</h4>
									{friends.length > 0 ? (
										<ScrollArea className="h-60 border rounded p-3">
											<div className="space-y-3">
												{friends.map((friend) => (
													<div
														key={friend.id}
														className="flex items-center justify-between p-3 border rounded bg-white gap-3"
													>
														<div className="flex-1 min-w-0 space-y-1">
															<div className="font-medium truncate">
																{friend.username}
															</div>
															<div className="text-xs text-gray-500 truncate">
																{friend.email}
															</div>
														</div>
														<Button
															size="icon"
															variant="ghost"
															className="h-9 w-9 flex-shrink-0"
															onClick={() => handleRemoveFriend(friend.id)}
														>
															<UserMinus className="h-4 w-4 text-red-500" />
														</Button>
													</div>
												))}
											</div>
										</ScrollArea>
									) : (
										<div className="text-sm text-gray-500 text-center py-6 border rounded">
											No friends added yet. Add friends by their email address.
										</div>
									)}
								</div>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			{/* Create Event Button */}
			<Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
				<DialogTrigger asChild>
					<Button
						size="lg"
						className="absolute bottom-28 right-4 z-20 rounded-full h-14 w-14 shadow-lg"
					>
						<Plus className="h-6 w-6" />
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Create New Event</DialogTitle>
						<DialogDescription>
							Share your event with the community
						</DialogDescription>
					</DialogHeader>
					{validationErrors.length > 0 && (
						<div className="bg-red-50 border border-red-200 rounded p-3">
							<p className="text-sm text-red-600 font-medium mb-1">
								Please fill in the following required fields:
							</p>
							<ul className="text-sm text-red-600 list-disc list-inside">
								{validationErrors.map((error) => (
									<li key={error}>{error}</li>
								))}
							</ul>
						</div>
					)}
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="event-title">Event Title</Label>
							<Input
								id="event-title"
								value={eventTitle}
								onChange={(e) => setEventTitle(e.target.value)}
								placeholder="Summer Music Festival"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="event-desc">Description</Label>
							<Textarea
								id="event-desc"
								value={eventDescription}
								onChange={(e) => setEventDescription(e.target.value)}
								placeholder="Tell people about your event..."
								rows={4}
							/>
						</div>

						<div className="flex items-center gap-2">
							<Checkbox
								id="use-location"
								checked={useCurrentLocation}
								onCheckedChange={(checked) =>
									setUseCurrentLocation(checked as boolean)
								}
							/>
							<Label htmlFor="use-location">Use my current location</Label>
						</div>

						{!useCurrentLocation && (
							<div className="space-y-2 relative">
								<Label htmlFor="event-location">Location</Label>
								<Input
									ref={locationInputRef}
									id="event-location"
									value={eventLocation}
									onChange={(e) => handleLocationInputChange(e.target.value)}
									onFocus={() => {
										if (locationSuggestions.length > 0) {
											setShowLocationSuggestions(true);
										}
									}}
									placeholder="Start typing an address..."
								/>
								{showLocationSuggestions && locationSuggestions.length > 0 && (
									<div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
										{locationSuggestions.map((suggestion) => (
											<button
												type="button"
												key={suggestion.place_id}
												className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm cursor-pointer"
												onMouseDown={(e) => {
													// Prevent input blur when clicking
													e.preventDefault();
													e.stopPropagation();
													handleSelectLocationSuggestion(suggestion);
												}}
											>
												<div className="flex items-start gap-2">
													<MapPin className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
													<span>{suggestion.description}</span>
												</div>
											</button>
										))}
									</div>
								)}
							</div>
						)}

						<div className="space-y-2">
							<Label>Start Date & Time</Label>
							<div className="flex gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="flex-1 justify-start text-left"
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{eventStartDate
												? format(eventStartDate, "PPP")
												: "Pick a date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={eventStartDate}
											onSelect={(date) => {
												setEventStartDate(date);
												// Auto-set end date to same day if not set
												if (!eventEndDate && date) {
													setEventEndDate(date);
												}
											}}
										/>
									</PopoverContent>
								</Popover>
								<div className="w-32">
									<Input
										type="time"
										value={eventStartTime}
										onChange={(e) => {
											setEventStartTime(e.target.value);
											// Auto-update end time to 1 hour later
											const [hours, minutes] = e.target.value
												.split(":")
												.map(Number);
											const newEndHour = (hours + 1) % 24;

											// If adding 1 hour crosses midnight (23:00 -> 00:00), move to next day
											if (hours === 23) {
												// Set end date to next day
												if (eventStartDate) {
													const nextDay = new Date(eventStartDate);
													nextDay.setDate(nextDay.getDate() + 1);
													setEventEndDate(nextDay);
												}
											} else {
												// Same day - set end date to start date
												if (eventStartDate) {
													setEventEndDate(eventStartDate);
												}
											}

											setEventEndTime(
												`${String(newEndHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
											);
										}}
									/>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<Label>End Date & Time (Optional)</Label>
							<div className="flex gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="flex-1 justify-start text-left"
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{eventEndDate ? format(eventEndDate, "PPP") : "Same day"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={eventEndDate}
											onSelect={(date) => {
												setEventEndDate(date);
												// Clear validation errors when user changes end date
												if (
													validationErrors.includes(
														"End date/time must be after start date/time",
													)
												) {
													setValidationErrors([]);
												}
											}}
											disabled={(date) => {
												// Disable dates before the start date
												if (!eventStartDate) return false;
												const startDateOnly = new Date(eventStartDate);
												startDateOnly.setHours(0, 0, 0, 0);
												return date < startDateOnly;
											}}
										/>
									</PopoverContent>
								</Popover>
								<div className="w-32">
									<Input
										type="time"
										value={eventEndTime}
										onChange={(e) => {
											setEventEndTime(e.target.value);
											// Clear validation errors when user changes end time
											if (
												validationErrors.includes(
													"End date/time must be after start date/time",
												)
											) {
												setValidationErrors([]);
											}
										}}
									/>
								</div>
							</div>
							<p className="text-xs text-gray-500">
								Defaults to 1 hour after start time
							</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="event-price">Price</Label>
								<Input
									id="event-price"
									type="number"
									value={eventPrice}
									onChange={(e) => setEventPrice(e.target.value)}
									placeholder="0"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="event-age">Age Requirement</Label>
								<Input
									id="event-age"
									type="number"
									value={eventAge}
									onChange={(e) => setEventAge(e.target.value)}
									placeholder="18"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="event-type">Event Type</Label>
							<div className="grid grid-cols-2 gap-2">
								{EVENT_TYPES.map((type) => (
									<button
										type="button"
										key={type}
										className={cn(
											"p-3 border rounded cursor-pointer transition-colors",
											eventType === type
												? "border-primary bg-primary/10"
												: "border-gray-200",
										)}
										onClick={() => setEventType(type)}
									>
										<div className="capitalize text-sm">
											{type.replace("_", " ")}
										</div>
									</button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="event-photo">Event Photo</Label>
							<Input
								id="event-photo"
								type="file"
								accept="image/*"
								onChange={(e) => setEventPhoto(e.target.files?.[0] || null)}
							/>
						</div>

						<Button
							onClick={handleCreateEvent}
							className="w-full"
							disabled={
								uploadFileMutation.isPending || tagEventMutation.isPending
							}
						>
							{uploadFileMutation.isPending || tagEventMutation.isPending
								? "Creating..."
								: "Create Event"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Edit Event Dialog */}
			<Dialog open={showEditEvent} onOpenChange={setShowEditEvent}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Event</DialogTitle>
						<DialogDescription>Update your event information</DialogDescription>
					</DialogHeader>
					{validationErrors.length > 0 && (
						<div className="bg-red-50 border border-red-200 rounded p-3">
							<p className="text-sm text-red-600 font-medium mb-1">
								Please fill in the following required fields:
							</p>
							<ul className="text-sm text-red-600 list-disc list-inside">
								{validationErrors.map((error) => (
									<li key={error}>{error}</li>
								))}
							</ul>
						</div>
					)}
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-event-title">Event Title</Label>
							<Input
								id="edit-event-title"
								value={eventTitle}
								onChange={(e) => setEventTitle(e.target.value)}
								placeholder="Summer Music Festival"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-event-desc">Description</Label>
							<Textarea
								id="edit-event-desc"
								value={eventDescription}
								onChange={(e) => setEventDescription(e.target.value)}
								placeholder="Tell people about your event..."
								rows={4}
							/>
						</div>

						<div className="flex items-center gap-2">
							<Checkbox
								id="edit-use-location"
								checked={useCurrentLocation}
								onCheckedChange={(checked) =>
									setUseCurrentLocation(checked as boolean)
								}
							/>
							<Label htmlFor="edit-use-location">Use my current location</Label>
						</div>

						{!useCurrentLocation && (
							<div className="space-y-2 relative">
								<Label htmlFor="edit-event-location">Location</Label>
								<Input
									ref={locationInputRef}
									id="edit-event-location"
									value={eventLocation}
									onChange={(e) => handleLocationInputChange(e.target.value)}
									onFocus={() => {
										if (locationSuggestions.length > 0) {
											setShowLocationSuggestions(true);
										}
									}}
									placeholder="Start typing an address..."
								/>
								{showLocationSuggestions && locationSuggestions.length > 0 && (
									<div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
										{locationSuggestions.map((suggestion) => (
											<button
												type="button"
												key={suggestion.place_id}
												className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm cursor-pointer"
												onMouseDown={(e) => {
													// Prevent input blur when clicking
													e.preventDefault();
													e.stopPropagation();
													handleSelectLocationSuggestion(suggestion);
												}}
											>
												<div className="flex items-start gap-2">
													<MapPin className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
													<span>{suggestion.description}</span>
												</div>
											</button>
										))}
									</div>
								)}
							</div>
						)}

						<div className="space-y-2">
							<Label>Start Date & Time</Label>
							<div className="flex gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="flex-1 justify-start text-left"
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{eventStartDate
												? format(eventStartDate, "PPP")
												: "Pick a date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={eventStartDate}
											onSelect={(date) => {
												setEventStartDate(date);
												// Auto-set end date to same day if not set
												if (!eventEndDate && date) {
													setEventEndDate(date);
												}
											}}
										/>
									</PopoverContent>
								</Popover>
								<div className="w-32">
									<Input
										type="time"
										value={eventStartTime}
										onChange={(e) => {
											setEventStartTime(e.target.value);
											// Auto-update end time to 1 hour later
											const [hours, minutes] = e.target.value
												.split(":")
												.map(Number);
											const newEndHour = (hours + 1) % 24;

											// If adding 1 hour crosses midnight (23:00 -> 00:00), move to next day
											if (hours === 23) {
												// Set end date to next day
												if (eventStartDate) {
													const nextDay = new Date(eventStartDate);
													nextDay.setDate(nextDay.getDate() + 1);
													setEventEndDate(nextDay);
												}
											} else {
												// Same day - set end date to start date
												if (eventStartDate) {
													setEventEndDate(eventStartDate);
												}
											}

											setEventEndTime(
												`${String(newEndHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
											);
										}}
									/>
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<Label>End Date & Time (Optional)</Label>
							<div className="flex gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="flex-1 justify-start text-left"
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{eventEndDate ? format(eventEndDate, "PPP") : "Same day"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={eventEndDate}
											onSelect={(date) => {
												setEventEndDate(date);
												// Clear validation errors when user changes end date
												if (
													validationErrors.includes(
														"End date/time must be after start date/time",
													)
												) {
													setValidationErrors([]);
												}
											}}
											disabled={(date) => {
												// Disable dates before the start date
												if (!eventStartDate) return false;
												const startDateOnly = new Date(eventStartDate);
												startDateOnly.setHours(0, 0, 0, 0);
												return date < startDateOnly;
											}}
										/>
									</PopoverContent>
								</Popover>
								<div className="w-32">
									<Input
										type="time"
										value={eventEndTime}
										onChange={(e) => {
											setEventEndTime(e.target.value);
											// Clear validation errors when user changes end time
											if (
												validationErrors.includes(
													"End date/time must be after start date/time",
												)
											) {
												setValidationErrors([]);
											}
										}}
									/>
								</div>
							</div>
							<p className="text-xs text-gray-500">
								Defaults to 1 hour after start time
							</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="edit-event-price">Price</Label>
								<Input
									id="edit-event-price"
									type="number"
									value={eventPrice}
									onChange={(e) => setEventPrice(e.target.value)}
									placeholder="0"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="edit-event-age">Age Requirement</Label>
								<Input
									id="edit-event-age"
									type="number"
									value={eventAge}
									onChange={(e) => setEventAge(e.target.value)}
									placeholder="18"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-event-type">Event Type</Label>
							<div className="grid grid-cols-2 gap-2">
								{EVENT_TYPES.map((type) => (
									<button
										type="button"
										key={type}
										className={cn(
											"p-3 border rounded cursor-pointer transition-colors",
											eventType === type
												? "border-primary bg-primary/10"
												: "border-gray-200",
										)}
										onClick={() => setEventType(type)}
									>
										<div className="capitalize text-sm">
											{type.replace("_", " ")}
										</div>
									</button>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-event-photo">Update Event Photo</Label>
							<Input
								id="edit-event-photo"
								type="file"
								accept="image/*"
								onChange={(e) => setEventPhoto(e.target.files?.[0] || null)}
							/>
							{editingEvent?.photo_url && !eventPhoto && (
								<p className="text-xs text-gray-500">
									Current photo will be kept unless you upload a new one
								</p>
							)}
						</div>

						<div className="flex gap-2">
							<Button
								onClick={handleUpdateEvent}
								className="flex-1"
								disabled={
									uploadFileMutation.isPending || tagEventMutation.isPending
								}
							>
								{uploadFileMutation.isPending || tagEventMutation.isPending
									? "Updating..."
									: "Update Event"}
							</Button>
							<Button
								variant="outline"
								onClick={() => {
									setShowEditEvent(false);
									setEditingEvent(null);
									setValidationErrors([]);
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Bottom Draggable Overlay */}
			<div
				className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t z-10 transition-all"
				style={{ height: `${overlayHeight}%` }}
			>
				{/* Drag handle */}
				<div
					className="w-full py-2 flex justify-center cursor-grab active:cursor-grabbing"
					onMouseDown={handleDragStart}
					onTouchStart={handleDragStart}
				>
					<div className="w-12 h-1 bg-gray-300 rounded-full" />
				</div>

				<div className="px-4 pb-4 h-[calc(100%-2rem)] flex flex-col">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold">
							{filteredEvents.length} Events Near You
						</h2>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setShowFilters(!showFilters)}
						>
							<Filter className="h-4 w-4 mr-2" />
							Filters
						</Button>
					</div>

					{showFilters && (
						<div className="mb-4 p-3 border rounded space-y-3">
							<div className="flex gap-2 flex-wrap">
								<Popover>
									<PopoverTrigger asChild>
										<Button variant="outline" size="sm">
											<CalendarIcon className="h-4 w-4 mr-2" />
											{filterDate ? format(filterDate, "PP") : "Any date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={filterDate}
											onSelect={setFilterDate}
										/>
									</PopoverContent>
								</Popover>

								<Button
									variant={filterPrice === "free" ? "default" : "outline"}
									size="sm"
									onClick={() =>
										setFilterPrice(filterPrice === "free" ? "all" : "free")
									}
								>
									<DollarSign className="h-4 w-4 mr-2" />
									Free Only
								</Button>
							</div>
							<div className="flex gap-2 flex-wrap">
								{EVENT_TYPES.filter((type) => type !== "hobbyist_events").map(
									(type) => (
										<Badge
											key={type}
											variant={
												filterTypes.includes(type) ? "default" : "outline"
											}
											className="cursor-pointer"
											onClick={() => {
												if (filterTypes.includes(type)) {
													setFilterTypes(filterTypes.filter((t) => t !== type));
												} else {
													setFilterTypes([...filterTypes, type]);
												}
											}}
										>
											{type.replace("_", " ")}
										</Badge>
									),
								)}
							</div>
						</div>
					)}

					<div className="flex-1 overflow-hidden">
						{filteredEvents.length > 0 ? (
							<div
								className="flex gap-4 overflow-x-auto h-full pb-2 snap-x snap-mandatory scroll-smooth"
								style={{
									scrollbarWidth: "thin",
									WebkitOverflowScrolling: "touch",
								}}
							>
								{filteredEvents.map((event) => {
									const friendsGoing = getFriendsGoingToEvent(event.id);
									// Format age requirement
									const ageDisplay =
										!event.age_requirement || event.age_requirement === 0
											? "All Ages!"
											: event.age_requirement === 18
												? "18+"
												: event.age_requirement === 21
													? "21+"
													: `${event.age_requirement}+`;

									return (
										<div
											key={event.id}
											className="flex-shrink-0 w-64 snap-start"
										>
											<Card
												className="h-full cursor-pointer overflow-hidden flex flex-col"
												onClick={() => {
													setComments([]); // Clear comments before loading new event
													setSelectedEvent(event);
													loadEventComments(event.id);
												}}
											>
												<CardHeader className="pb-3">
													<div className="flex items-start justify-between gap-2">
														<CardTitle className="text-base line-clamp-2 break-words">
															{event.title}
															{currentUser?.event_preference?.includes(
																event.event_type,
															) && " ⭐"}
														</CardTitle>
														{event.is_popular && (
															<Badge
																variant="default"
																className="bg-yellow-500 flex-shrink-0"
															>
																Popular
															</Badge>
														)}
													</div>
													<CardDescription className="flex items-center gap-1 overflow-hidden">
														<MapPin
															className={`h-3 w-3 flex-shrink-0 ${getMapPinColor(event.event_type)}`}
														/>
														<span className="truncate text-xs">
															{eventAddresses[event.id] ||
																event.location_address}
														</span>
													</CardDescription>
												</CardHeader>
												<CardContent className="space-y-2 overflow-hidden flex-1">
													<p className="text-sm text-gray-600 line-clamp-2 break-words">
														{event.description}
													</p>
													<div className="space-y-1.5 text-sm">
														<div className="flex items-center gap-2 overflow-hidden">
															<Clock className="h-3 w-3 flex-shrink-0" />
															<span className="truncate text-xs">
																{format(new Date(event.start_datetime), "PPP")}
															</span>
														</div>
														<div className="flex items-center gap-2 overflow-hidden">
															<Tag className="h-3 w-3 flex-shrink-0" />
															<Badge
																variant="secondary"
																className="truncate text-xs"
															>
																{event.event_type}
															</Badge>
														</div>
														<div className="flex items-center gap-2 overflow-hidden">
															<DollarSign className="h-3 w-3 flex-shrink-0" />
															<span className="truncate text-xs">
																{event.price === 0 ? "Free" : `$${event.price}`}
															</span>
														</div>
														<div className="flex items-center gap-2 overflow-hidden">
															<User className="h-3 w-3 flex-shrink-0" />
															<span className="truncate text-xs font-medium">
																{ageDisplay}
															</span>
														</div>
														{friendsGoing.length > 0 && (
															<div className="flex items-center gap-2 pt-1.5 border-t overflow-hidden">
																<Users className="h-3 w-3 flex-shrink-0 text-blue-500" />
																<span className="text-xs text-blue-600 truncate">
																	{friendsGoing.length === 1
																		? `${friendsGoing[0].username} is going!`
																		: `${friendsGoing[0].username} +${friendsGoing.length - 1} going!`}
																</span>
															</div>
														)}
													</div>
												</CardContent>
											</Card>
										</div>
									);
								})}
							</div>
						) : (
							<div className="flex items-center justify-center h-full text-gray-500">
								No events found matching your filters
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Event Detail Dialog */}
			{selectedEvent && (
				<Dialog
					open={!!selectedEvent}
					onOpenChange={() => {
						setSelectedEvent(null);
						setComments([]); // Clear comments when dialog closes
						setReplyingTo(null);
						setReplyText("");
						setCommentText("");
					}}
				>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<DialogTitle className="text-2xl">
										{selectedEvent.title}
										{currentUser?.event_preference?.includes(
											selectedEvent.event_type,
										) && " ⭐"}
									</DialogTitle>
									<DialogDescription className="flex items-center gap-2 mt-2">
										<MapPin
											className={`h-4 w-4 ${getMapPinColor(selectedEvent.event_type)}`}
										/>
										{eventAddresses[selectedEvent.id] ||
											selectedEvent.location_address}
									</DialogDescription>
								</div>
								{selectedEvent.organizer_id === currentUser?.id && (
									<div className="flex gap-2 mr-8">
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleOpenEditEvent(selectedEvent)}
										>
											<Edit className="h-4 w-4 mr-2" />
											Edit
										</Button>
										<Button
											size="sm"
											variant="destructive"
											onClick={() => handleDeleteEvent(selectedEvent)}
										>
											Delete
										</Button>
									</div>
								)}
							</div>
						</DialogHeader>

						{selectedEvent.photo_url && (
							<img
								src={selectedEvent.photo_url}
								alt={selectedEvent.title}
								className="w-full h-48 object-cover rounded"
							/>
						)}

						<div className="space-y-4">
							<div>
								<h3 className="font-medium mb-2">Description</h3>
								<p className="text-sm text-gray-600">
									{selectedEvent.description}
								</p>
							</div>

							<Separator />

							<div className="grid grid-cols-2 gap-4">
								<div>
									<div className="text-sm font-medium">Date & Time</div>
									<div className="text-sm text-gray-600">
										{format(new Date(selectedEvent.start_datetime), "PPP p")}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium">Event Type</div>
									<Badge
										variant="secondary"
										className={getEventTypeBadgeClass(selectedEvent.event_type)}
									>
										{selectedEvent.event_type}
									</Badge>
								</div>
								<div>
									<div className="text-sm font-medium">Price</div>
									<div className="text-sm text-gray-600">
										{selectedEvent.price === 0
											? "Free"
											: `$${selectedEvent.price}`}
									</div>
								</div>
								{selectedEvent.age_requirement &&
									selectedEvent.age_requirement > 0 && (
										<div>
											<div className="text-sm font-medium">Age Requirement</div>
											<div className="text-sm text-gray-600">
												{selectedEvent.age_requirement}+
											</div>
										</div>
									)}
							</div>

							{selectedEvent.tag && selectedEvent.tag.length > 0 && (
								<div>
									<div className="text-sm font-medium mb-2">Tags</div>
									<div className="flex flex-wrap gap-2">
										{selectedEvent.tag.map((tag: string) => (
											<Badge key={tag} variant="outline">
												{tag}
											</Badge>
										))}
									</div>
								</div>
							)}

							<Separator />

							<div className="flex gap-2">
								{(() => {
									const hasRSVPd = userRSVPs.some(
										(r) => r.event_id === selectedEvent.id,
									);
									return (
										<Button
											onClick={() => handleRSVP(selectedEvent)}
											className="flex-1"
											variant={hasRSVPd ? "default" : "outline"}
										>
											<Heart
												className={cn(
													"h-4 w-4 mr-2",
													hasRSVPd && "fill-current",
												)}
											/>
											{hasRSVPd ? "Cancel RSVP" : "RSVP"}
										</Button>
									);
								})()}
								<Button
									variant="outline"
									onClick={() => handleShareEvent(selectedEvent)}
								>
									<Share2 className="h-4 w-4" />
								</Button>
							</div>

							<Separator />

							<div>
								<h3 className="font-medium mb-3">Comments</h3>
								<ScrollArea className="h-40 mb-3">
									<div className="space-y-3">
										{comments
											.filter((c) => !c.content.startsWith("@reply:"))
											.map((comment) => {
												// Find replies to this comment
												const replies = comments.filter((c) =>
													c.content.startsWith(`@reply:${comment.id}|`),
												);

												return (
													<div key={comment.id} className="space-y-2">
														<div className="p-3 border rounded">
															<div className="text-sm">{comment.content}</div>
															<div className="flex items-center justify-between mt-2">
																<div className="text-xs text-gray-500">
																	{safeFormatDate(comment.create_time, "PPP")}
																</div>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => setReplyingTo(comment.id)}
																	className="h-6 px-2"
																>
																	<Reply className="h-3 w-3 mr-1" />
																	Reply
																</Button>
															</div>

															{/* Reply input */}
															{replyingTo === comment.id && (
																<div className="mt-3 flex gap-2">
																	<Textarea
																		value={replyText}
																		onChange={(e) =>
																			setReplyText(e.target.value)
																		}
																		placeholder="Write a reply..."
																		rows={2}
																		className="text-sm"
																	/>
																	<div className="flex flex-col gap-1">
																		<Button
																			size="icon"
																			onClick={() =>
																				handlePostReply(comment.id)
																			}
																			className="h-8 w-8"
																		>
																			<Send className="h-3 w-3" />
																		</Button>
																		<Button
																			size="icon"
																			variant="outline"
																			onClick={() => {
																				setReplyingTo(null);
																				setReplyText("");
																			}}
																			className="h-8 w-8"
																		>
																			×
																		</Button>
																	</div>
																</div>
															)}
														</div>

														{/* Display replies (subcomments) */}
														{replies.length > 0 && (
															<div className="ml-8 space-y-2">
																{replies.map((reply) => {
																	const replyContent = reply.content.replace(
																		/^@reply:[^|]+\|/,
																		"",
																	);
																	return (
																		<div
																			key={reply.id}
																			className="p-2 border rounded bg-gray-50 text-sm"
																		>
																			<div>{replyContent}</div>
																			<div className="text-xs text-gray-500 mt-1">
																				{safeFormatDate(
																					reply.create_time,
																					"PPP",
																				)}
																			</div>
																		</div>
																	);
																})}
															</div>
														)}
													</div>
												);
											})}
										{comments.length === 0 && (
											<div className="text-sm text-gray-500 text-center py-4">
												No comments yet. Be the first to comment!
											</div>
										)}
									</div>
								</ScrollArea>
								<div className="flex gap-2">
									<Textarea
										value={commentText}
										onChange={(e) => setCommentText(e.target.value)}
										placeholder="Add a comment..."
										rows={2}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												handlePostComment();
											}
										}}
									/>
									<Button
										size="icon"
										onClick={handlePostComment}
										disabled={!commentText.trim()}
									>
										<Send className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
