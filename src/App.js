/* global google */
import _ from "lodash";

import {default as React, Component} from "react";
import './App.css';
import {withGoogleMap, GoogleMap, Marker, DirectionsRenderer} from "react-google-maps";

var Config = require('./Config');

// GoogleMap Wrapper
const RouteGoogleMap = withGoogleMap(props => (
        <GoogleMap
            ref={props.onMapLoad}
            defaultZoom={11}
            defaultCenter={{lat: 22.3401192, lng: 114.0716614}}
            onClick={props.onMapClick}
        >
            {props.markers.map(marker => (
                <Marker
                    {...marker}
                    onRightClick={() => props.onMarkerRightClick(marker)}
                />
            ))}
            {props.directions && <DirectionsRenderer directions={props.directions}/>}
        </GoogleMap>
    )
);

// Main class
export default class App extends Component {
    state = {
        markers: [],
        directions: null,
        showButton: false,
        status: ''
    };

    handleMapLoad = this.handleMapLoad.bind(this);
    handleMapClick = this.handleMapClick.bind(this);
    handleMarkerRightClick = this.handleMarkerRightClick.bind(this);
    getToken = this.getToken.bind(this);
    getOptimizedSeq = this.getOptimizedSeq.bind(this);
    getRoute = this.getRoute.bind(this);

    handleMapLoad(map) {
        this._mapComponent = map;
    }

    // Handle left click to on map - add locations
    handleMapClick(event) {
        let nextMarkers = [
            ...this.state.markers,
            {
                position: event.latLng,
                defaultAnimation: 2,
                label: (this.state.markers.length === 0) ? 'Start' : '' + this.state.markers.length,
                key: Date.now(), // Add a key property for: http://fb.me/react-warning-keys
            },
        ];
        this.setState({
            markers: nextMarkers,
            showButton: nextMarkers.length > 1 ? true : false
        });
    }

    // Handle right click to on map - add locations - remove locations
    handleMarkerRightClick(targetMarker) {
        const nextMarkers = this.state.markers.filter(marker => marker !== targetMarker);
        nextMarkers.forEach((marker, i) => marker.label = (i === 0) ? 'Start' : '' + i);
        this.setState({
            markers: nextMarkers,
            showButton: nextMarkers.length > 1 ? true : false
        });
    }

    // submit locations and get token from server
    getToken() {
        this.setState({
            showButton: false,
            status: 'Optimizing path. Please wait.'
        });
        const data = [];
        this.state.markers.forEach((marker) => {data.push([marker.position.lat(),marker.position.lng()]) });
        fetch(Config.backendHost + 'route', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then((response) => response.json())
        .then((responseJson) => {
            this.getOptimizedSeq(responseJson.token);
        })
        .catch((error) => {
            this.setState({
                showButton: true,
                status: 'Error in optimizing path. Please try again.'
            });
        });
    }

    // get optimized routing sequence from server
    getOptimizedSeq(token) {
        fetch(Config.backendHost + 'route/' + token, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        })
        .then((response) => response.json())
        .then((responseJson) => {
            if(responseJson.status==='success'){
                const optimized = [];
                responseJson.path.forEach(path =>{optimized.push(new google.maps.LatLng(parseFloat(path[0]), parseFloat(path[1])))});
                this.setState({
                    markers: [],
                    status: 'Found optimized path. Get route now.'
                });
                this.getRoute(optimized);
            }else if (responseJson.status==='in progress'){
                this.setState({
                    status: 'Optimizing path in progress. Please wait.'
                });
                setTimeout(this.getOptimizedSeq(token), Config.retry_time);
            }else if (responseJson.status==='failure'){
                this.setState({
                    showButton: true,
                    status: 'Error in optimizing path. Please try again.'
                });
            }
        })
        .catch((error) => {
            this.setState({
                showButton: true,
                status: 'Failed to optimizing path. Please try again.'
            });
        });
    }

    // Get Route by Google Directions service
    getRoute(path) {
        if (path.length > 1) {
            const DirectionsService = new google.maps.DirectionsService();
            var waypts = [];
            path.forEach((p, i) => {
                if (i > 0 && i < path.length - 1) {
                    waypts.push({
                        location: p,
                        stopover: true
                    })
                }
            });
            DirectionsService.route({
                origin: path[0],
                destination: path[path.length - 1],
                waypoints: waypts,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false
            }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    this.setState({
                        markers: [],
                        status: 'Get route done!',
                        directions: result
                    });
                } else {
                    this.setState({
                        status: 'Error in getting route. Please try again',
                    });
                }
            });
        }
    }

    // render map
    render() {
        return (
            <div className="App">
                <div className="App-header">
                    <img src="logo.png" className="App-logo" alt="logo"/>
                    <h2>Driving Route Drawing</h2>
                    <ul>
                        <li>Left click map to add locations and drop-off locations.</li>
                        <li>Right click map to remove locations</li>
                        <li>Mark at least 2 locations</li>
                    </ul>
                    { this.state.showButton ? <button onClick={this.getToken}>Get Route</button> : ''}
                    <p className="Warning">{this.state.status}</p>
                </div>
                <RouteGoogleMap
                    containerElement={
                        <div className="Map"/>
                    }
                    mapElement={
                        <div style={{height: `100%`}}/>
                    }
                    onMapLoad={this.handleMapLoad}
                    onMapClick={this.handleMapClick}
                    markers={this.state.markers}
                    onMarkerRightClick={this.handleMarkerRightClick}
                    directions={this.state.directions}
                />
            </div>
        );
    }
}