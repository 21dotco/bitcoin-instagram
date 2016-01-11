#! /bin/bash -eu

## Print help if wrong number of arguments provided
if [ $# -ne 1 ]
then
  echo "Usage: bash $0 <instagram_user_name>"
  exit 1
fi

VENV="venv"
FRONTEND="bitcoin_instagram_frontend"
CREATEDB="create_and_populate_db.py"
INSTAUSER="$1"

ZT_NETID=e5cd7a9e1cc66764

## Was setup.sh run with an absolute path?  (E.g. /foo/bar/setup.sh)
if [ ${0::1} == "/" ]
then
  ## An absolute path was used, so the directory holding setup.sh is the
  ## repository directory
  repository_directory=$( dirname $0 )
else
  ## A relative path was used, so the absolute path from the Print
  ## Working Directory (PWD) plus the relative path to directory holding
  ## setup.sh is the repository directory
  repository_directory=$( dirname $PWD/$0 )
fi
cd $repository_directory

_exit_fully() {
  ## Kill all subprocesses of this script. This way we can
  ## background processes and still have everything exit when we
  ## Ctrl-C the this script
  kill -TERM -$$
}

## Run _exit_fully() anytime this script terminates.
trap _exit_fully EXIT

echo "Connecting to zerotier"
if ! sudo zerotier-cli listnetworks | grep -q $ZT_NETID
then
    sudo zerotier-cli join $ZT_NETID
fi

## Sleep for a few seconds for the IP to come up
sleep 10

## Get zerotier IP address
zt_ip=$( sudo zerotier-cli listnetworks | grep $ZT_NETID | cut -d' ' -f9 | cut -d/ -f1 )

## Install node.js if it isn't installed already
if ! dpkg -l nodejs | grep -q '^ii'
then
  echo "Installing system dependencies"
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get -y install nodejs build-essential graphicsmagick ghostscript
fi

echo "Running npm to install dependencies."
npm install

## Scrape account if not done already
download_dir=$repository_directory/$FRONTEND/static/$INSTAUSER
if ! ls $download_dir | grep -c .
then
  ## Get the password from a prompt (rather than from a command line
  ## parameter which would be stored in the user's bash history)
  echo    "Enter your Instagram password and press enter (note: characters you"
  echo -n "type will not be shown for privacy): "
  read -s INSTAPASSWORD
  echo

  echo "Running node to scrape your instagram account."
  node instagram.js $INSTAUSER $INSTAPASSWORD $download_dir
fi

echo "Installing Python dependencies"
if [ "${VIRTUAL_ENV:-}" ]
then
  pip3 install flask
  pip3 install Flask-BasicAuth
else
  sudo pip3 install flask
  sudo pip3 install Flask-BasicAuth
fi

echo "Creating a database of photos"
cd $repository_directory/$FRONTEND/management
python3 $CREATEDB $INSTAUSER

echo "Linking the client.py script to users home folder"
ln -sf $repository_directory/bitcoin_instagram_frontend/client.py $HOME/instagram_client.py
cd $repository_directory/bitcoin_instagram_frontend

echo "Starting server"
python3 server.py $INSTAUSER &

sleep 3
echo "The files that you're selling: http://$zt_ip:5000/instagram"
echo "The files that you've purchased: http://$zt_ip:5000/instagram/purchased"
echo "Default username/password for purchased files: admin/default"

## Wait for script to exit before returning to terminal
wait
