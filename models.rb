require "data_mapper"
require "carrierwave"
require "carrierwave/datamapper"
require "./config/settings"
require $DBGEM

# DataMapper::Logger.new(STDOUT, :debug)
DataMapper::setup(:default, $DBSTRING)

class AudioUploader < CarrierWave::Uploader::Base
  storage :file

  def store_dir
    "public/audio/#{model.validationstring}/"
  end

  def extensions_white_list
    %w(wav)
  end

  def move_to_store
    true
  end

  def md5
    chunk = model.send(mounted_as)
    @md5 ||= Digest::MD5.hexdigest(chunk.read.to_s)
  end

  def filename
    # save filename as md5 hash of file.
    # useful for later duplicate checking
    @name ||= "#{md5}#{File.extname(super)}" if super
  end
end

class Audio
  include DataMapper::Resource
  # Unique key
  property :id, Serial
  # Optional description
  property :description, Text
  # Email for validation
  property :email, Text, :required => true
  # What to detect for
  property :detection, Enum[:wind, :mic, :distortion]
  # Upload time
  property :created_at, DateTime
  # Processing completion time
  property :completed_at, DateTime
  # Audio length in seconds for estimating processing time
  property :filelength, Float, :default => 0
  # Unique string needed to validate
  property :validationstring, String
  # Has the file been validated by clicking the email link?
  # Defaults to true in case server is restarted with this setting changed
  property :validated, Boolean, :default => true
  # Has the file been processed?
  property :processed, Boolean, :default => false
  # How long did it take to process in seconds?
  property :processingtime, Float, :default => 0
  # Was the file processed successfully? 0 == yes, other values for error codes
  property :success, Boolean, :default => false
  # Has it expired and been deleted?
  property :expired, Boolean, :default => false
  # What feedback did the user give?
  property :feedbackrating, Integer
  property :feedbacktext, Text
  # Uploader gizmo
  mount_uploader :source, AudioUploader
end

DataMapper.finalize
# DataMapper.auto_migrate!
# DataMapper.auto_upgrade!
